/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  RotateCcw, 
  Play, 
  Clock, 
  Zap, 
  ChevronLeft,
  AlertCircle,
  Pause,
  Volume2,
  VolumeX
} from 'lucide-react';
import { 
  GameMode, 
  GameState, 
  BlockData, 
  GRID_WIDTH, 
  GRID_HEIGHT, 
  INITIAL_ROWS,
  getRandomValue,
  getRandomColor,
  generateId
} from './types';

export default function App() {
  const [gameState, setGameState] = useState<GameState>('menu');
  const [mode, setMode] = useState<GameMode>('classic');
  const [grid, setGrid] = useState<(BlockData | null)[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [targetSum, setTargetSum] = useState<number>(10);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [isPaused, setIsPaused] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playSound = useCallback((frequency: number, type: OscillatorType = 'sine', duration: number = 0.1, volume: number = 0.1) => {
    if (!soundEnabled) return;
    
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.error("Audio error", e);
    }
  }, [soundEnabled]);

  const playClickSound = () => playSound(800, 'sine', 0.05, 0.1);
  const playSuccessSound = () => {
    playSound(600, 'triangle', 0.1, 0.1);
    setTimeout(() => playSound(1200, 'triangle', 0.2, 0.1), 100);
  };
  const playFailSound = () => playSound(200, 'sawtooth', 0.2, 0.05);
  const playGameOverSound = () => {
    playSound(400, 'sawtooth', 0.2, 0.1);
    setTimeout(() => playSound(300, 'sawtooth', 0.3, 0.1), 200);
    setTimeout(() => playSound(200, 'sawtooth', 0.5, 0.1), 500);
  };

  // Initialize high score
  useEffect(() => {
    const saved = localStorage.getItem('sum-merge-highscore');
    if (saved) setHighScore(parseInt(saved));
  }, []);

  // Save high score
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('sum-merge-highscore', score.toString());
    }
  }, [score, highScore]);

  const generateTarget = useCallback((currentGrid: (BlockData | null)[]) => {
    const availableValues = currentGrid.filter(b => b !== null).map(b => b!.value);
    if (availableValues.length === 0) return 10;
    
    // Pick 2-3 random blocks to sum up for a guaranteed solvable target
    const numToSum = Math.min(availableValues.length, Math.floor(Math.random() * 2) + 2);
    const shuffled = [...availableValues].sort(() => 0.5 - Math.random());
    const sum = shuffled.slice(0, numToSum).reduce((a, b) => a + b, 0);
    
    return Math.max(5, Math.min(sum, 30));
  }, []);

  const addRow = useCallback(() => {
    setGrid(prev => {
      // Check if top row is occupied
      const topRowOccupied = prev.slice(0, GRID_WIDTH).some(b => b !== null);
      if (topRowOccupied) {
        playGameOverSound();
        setGameState('gameover');
        return prev;
      }

      // Shift everything up
      const newGrid = [...prev.slice(GRID_WIDTH), ...Array(GRID_WIDTH).fill(null)];
      
      // Add new row at the bottom with random number of blocks
      const numBlocks = Math.floor(Math.random() * (GRID_WIDTH - 1)) + 1; // 1 to 6 blocks for more variety
      const positions = Array.from({ length: GRID_WIDTH }, (_, i) => i)
        .sort(() => 0.5 - Math.random())
        .slice(0, numBlocks);

      positions.forEach(pos => {
        newGrid[newGrid.length - GRID_WIDTH + pos] = {
          id: generateId(),
          value: getRandomValue(),
          color: getRandomColor(),
        };
      });
      return newGrid;
    });
  }, []);

  const startGame = (selectedMode: GameMode) => {
    setMode(selectedMode);
    setScore(0);
    setSelectedIndices([]);
    
    // Initial grid: empty except bottom rows
    const initialGrid = Array(GRID_WIDTH * GRID_HEIGHT).fill(null);
    for (let i = (GRID_HEIGHT - INITIAL_ROWS) * GRID_WIDTH; i < GRID_WIDTH * GRID_HEIGHT; i++) {
      initialGrid[i] = {
        id: generateId(),
        value: getRandomValue(),
        color: getRandomColor(),
      };
    }
    
    setGrid(initialGrid);
    setTargetSum(generateTarget(initialGrid));
    setGameState('playing');
    setIsPaused(false);
    
    if (selectedMode === 'time') {
      setTimeLeft(15);
    }
  };

  // Timer logic for Time Mode
  useEffect(() => {
    if (gameState === 'playing' && mode === 'time' && !isPaused) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            addRow();
            setSelectedIndices([]); // Clear selection on timeout
            return 15;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState, mode, isPaused, addRow]);

  const handleBlockClick = (index: number) => {
    if (gameState !== 'playing' || isPaused || !grid[index]) return;

    playClickSound();

    setSelectedIndices(prev => {
      const isSelected = prev.includes(index);
      let next: number[];
      
      if (isSelected) {
        next = prev.filter(i => i !== index);
      } else {
        next = [...prev, index];
      }

      // Calculate sum
      const currentSum = next.reduce((sum, idx) => sum + (grid[idx]?.value || 0), 0);

      if (currentSum === targetSum) {
        // Success!
        playSuccessSound();
        setTimeout(() => {
          clearBlocks(next);
        }, 100);
        return [];
      } else if (currentSum > targetSum) {
        // Exceeded target, reset selection
        playFailSound();
        return [];
      }

      return next;
    });
  };

  const clearBlocks = (indices: number[]) => {
    setScore(prev => prev + (indices.length * 10) + (targetSum));
    
    setGrid(prev => {
      const nextGrid = [...prev];
      indices.forEach(idx => {
        nextGrid[idx] = null;
      });

      // Apply gravity: for each column, shift blocks down
      for (let col = 0; col < GRID_WIDTH; col++) {
        const columnBlocks: (BlockData | null)[] = [];
        for (let row = 0; row < GRID_HEIGHT; row++) {
          const block = nextGrid[row * GRID_WIDTH + col];
          if (block) columnBlocks.push(block);
        }
        
        // Fill from bottom
        const emptyCount = GRID_HEIGHT - columnBlocks.length;
        for (let row = 0; row < GRID_HEIGHT; row++) {
          if (row < emptyCount) {
            nextGrid[row * GRID_WIDTH + col] = null;
          } else {
            nextGrid[row * GRID_WIDTH + col] = columnBlocks[row - emptyCount];
          }
        }
      }

      // Check if grid is empty
      const isEmpty = nextGrid.every(b => b === null);
      if (isEmpty && mode === 'time') {
        // Immediately add row if empty in time mode
        setTimeout(() => addRow(), 0);
      }

      // Generate new target after grid update
      setTargetSum(generateTarget(nextGrid));
      
      return nextGrid;
    });

    if (mode === 'classic') {
      addRow();
    } else {
      setTimeLeft(15); // Reset timer on success in time mode
    }
  };

  const renderMenu = () => (
    <div className="flex flex-col items-center justify-center h-full space-y-12 p-8 bg-white relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute -top-24 -left-24 w-64 h-64 bg-emerald-50 rounded-full blur-3xl opacity-50" />
      <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-blue-50 rounded-full blur-3xl opacity-50" />

      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center relative z-10"
      >
        <div className="inline-block px-3 py-1 bg-zinc-900 text-white text-[10px] font-bold tracking-[0.2em] rounded-full mb-4 uppercase">
          Musk Edition
        </div>
        <h1 className="text-7xl font-black tracking-tighter text-zinc-900 mb-2 leading-none">
          数和<span className="text-emerald-500">消除</span>
        </h1>
        <p className="text-zinc-400 font-medium tracking-wide">掌握加法的艺术</p>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 w-full max-w-sm relative z-10">
        <button 
          onClick={() => startGame('classic')}
          className="group relative flex items-center p-5 bg-zinc-50 border border-zinc-200 rounded-2xl transition-all hover:bg-white hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-1 active:scale-[0.98]"
        >
          <div className="w-14 h-14 bg-emerald-500 text-white rounded-xl flex items-center justify-center mr-4 shadow-lg shadow-emerald-500/20">
            <Zap size={28} fill="currentColor" />
          </div>
          <div className="text-left">
            <h3 className="text-xl font-extrabold text-zinc-900">经典模式</h3>
            <p className="text-xs text-zinc-500 mt-0.5">每次消除后新增一行。挑战极限生存。</p>
          </div>
        </button>

        <button 
          onClick={() => startGame('time')}
          className="group relative flex items-center p-5 bg-zinc-50 border border-zinc-200 rounded-2xl transition-all hover:bg-white hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1 active:scale-[0.98]"
        >
          <div className="w-14 h-14 bg-blue-500 text-white rounded-xl flex items-center justify-center mr-4 shadow-lg shadow-blue-500/20">
            <Clock size={28} fill="currentColor" />
          </div>
          <div className="text-left">
            <h3 className="text-xl font-extrabold text-zinc-900">计时挑战</h3>
            <p className="text-xs text-zinc-500 mt-0.5">在时间耗尽前消除。速度决定胜负。</p>
          </div>
        </button>
      </div>

      <div className="flex flex-col items-center space-y-2 relative z-10">
        <div className="flex items-center space-x-2 text-zinc-400">
          <Trophy size={16} className="text-amber-500" />
          <span className="text-xs font-bold uppercase tracking-widest">最高分: {highScore}</span>
        </div>
      </div>
    </div>
  );

  const renderGame = () => (
    <div className="flex flex-col h-full max-w-lg mx-auto bg-zinc-50 relative">
      {/* Header */}
      <div className="p-6 border-b border-zinc-200 bg-white flex items-center justify-between relative z-10">
        <button 
          onClick={() => setGameState('menu')}
          className="w-10 h-10 flex items-center justify-center hover:bg-zinc-100 rounded-xl transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-[0.2em] leading-none mb-2">目标值</span>
          <div className="text-5xl font-black text-zinc-900 tabular-nums target-pulse">
            {targetSum}
          </div>
        </div>
 
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setIsPaused(!isPaused)}
            className="w-10 h-10 flex items-center justify-center hover:bg-zinc-100 rounded-xl transition-colors"
          >
            {isPaused ? <Play size={22} fill="currentColor" /> : <Pause size={22} fill="currentColor" />}
          </button>
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="w-10 h-10 flex items-center justify-center hover:bg-zinc-100 rounded-xl transition-colors"
          >
            {soundEnabled ? <Volume2 size={22} /> : <VolumeX size={22} />}
          </button>
        </div>
      </div>

      {/* Mode Indicator & Timer Bar */}
      {mode === 'time' && (
        <div className="h-1.5 w-full bg-zinc-200 overflow-hidden relative z-10">
          <motion.div 
            initial={false}
            animate={{ width: `${(timeLeft / 15) * 100}%` }}
            className={`h-full ${timeLeft <= 5 ? 'bg-rose-500' : 'bg-blue-500'} transition-all duration-1000 ease-linear`}
          />
        </div>
      )}
 
      {/* Stats Bar */}
      <div className="px-6 py-3 bg-white flex justify-between items-center border-b border-zinc-200 relative z-10">
        <div className="flex items-center space-x-6">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">得分</span>
            <span className="text-lg font-mono font-black text-zinc-900">{score}</span>
          </div>
          {mode === 'time' && (
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">剩余时间</span>
              <span className={`text-lg font-mono font-black ${timeLeft <= 5 ? 'text-rose-500 animate-pulse' : 'text-zinc-900'}`}>
                {timeLeft}s
              </span>
            </div>
          )}
        </div>
        <div className="px-3 py-1 bg-zinc-100 rounded-full text-[10px] font-black text-zinc-500 uppercase tracking-widest">
          {mode === 'classic' ? '经典模式' : '计时挑战'}
        </div>
      </div>
 
      {/* Grid Container */}
      <div className="flex-1 relative p-4 overflow-hidden bg-zinc-100">
        <div className="game-grid h-full w-full max-h-[600px] mx-auto">
          {grid.map((block, idx) => (
            <div key={idx} className="relative w-full h-full min-h-0">
              <AnimatePresence>
                {block && (
                  <motion.button
                    layoutId={block.id}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ 
                      scale: selectedIndices.includes(idx) ? 0.92 : 1, 
                      opacity: 1,
                      y: 0
                    }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    onClick={() => handleBlockClick(idx)}
                    className={`
                      absolute inset-0 w-full h-full rounded-none flex items-center justify-center
                      text-white font-black text-xl sm:text-2xl transition-all block-shadow
                      ${block.color}
                      ${selectedIndices.includes(idx) ? 'ring-4 ring-white ring-inset brightness-110 z-10 scale-95 shadow-xl' : 'hover:brightness-105 z-0 shadow-lg'}
                    `}
                  >
                    <span className="drop-shadow-sm">{block.value}</span>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
 
        {/* Pause Overlay */}
        <AnimatePresence>
          {isPaused && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center"
            >
              <div className="w-20 h-20 bg-zinc-900 text-white rounded-3xl flex items-center justify-center mb-6 shadow-2xl">
                <Pause size={40} fill="currentColor" />
              </div>
              <h2 className="text-4xl font-black tracking-tighter mb-8">游戏已暂停</h2>
              <button 
                onClick={() => setIsPaused(false)}
                className="px-10 py-4 bg-emerald-500 text-white rounded-2xl font-black flex items-center space-x-3 hover:scale-105 transition-transform shadow-xl shadow-emerald-500/20"
              >
                <Play size={24} fill="currentColor" />
                <span>继续游戏</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
 
      {/* Selection Preview */}
      <div className="p-6 bg-white border-t border-zinc-200 flex flex-col items-center space-y-4">
        <div className="flex items-center space-x-3">
          <div className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">当前选择</div>
          <div className="flex space-x-2 min-h-[40px] items-center">
            {selectedIndices.map(idx => (
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                key={idx} 
                className={`w-10 h-10 rounded-none ${grid[idx]?.color} flex items-center justify-center text-white text-sm font-black shadow-md`}
              >
                {grid[idx]?.value}
              </motion.div>
            ))}
            {selectedIndices.length > 0 && (
              <div className="text-zinc-300 font-black text-xl px-1">=</div>
            )}
            {selectedIndices.length > 0 && (
              <div className={`w-12 h-12 rounded-none bg-zinc-900 flex items-center justify-center text-white text-lg font-black shadow-xl border border-white/20`}>
                {selectedIndices.reduce((s, i) => s + (grid[i]?.value || 0), 0)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderGameOver = () => (
    <div className="flex flex-col items-center justify-center h-full p-6 bg-zinc-900 text-white">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center"
      >
        <AlertCircle size={64} className="mx-auto text-rose-500 mb-4" />
        <h2 className="text-5xl font-black tracking-tighter mb-2">游戏结束</h2>
        <p className="text-zinc-400 mb-8">方块触顶了！</p>
        
        <div className="bg-white/10 rounded-3xl p-8 mb-8 backdrop-blur-md border border-white/5">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">最终得分</div>
              <div className="text-4xl font-mono font-bold">{score}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">最高纪录</div>
              <div className="text-4xl font-mono font-bold">{highScore}</div>
            </div>
          </div>
        </div>

        <div className="flex flex-col space-y-3 w-full max-w-xs mx-auto">
          <button 
            onClick={() => startGame(mode)}
            className="w-full py-4 bg-white text-zinc-900 rounded-2xl font-bold flex items-center justify-center space-x-2 hover:bg-zinc-100 transition-colors"
          >
            <RotateCcw size={20} />
            <span>再试一次</span>
          </button>
          <button 
            onClick={() => setGameState('menu')}
            className="w-full py-4 bg-zinc-800 text-white rounded-2xl font-bold hover:bg-zinc-700 transition-colors"
          >
            返回主菜单
          </button>
        </div>
      </motion.div>
    </div>
  );

  return (
    <div className="h-screen w-full bg-zinc-100 flex items-center justify-center font-sans">
      <div className="w-full h-full max-w-md bg-white overflow-hidden shadow-2xl">
        {gameState === 'menu' && renderMenu()}
        {gameState === 'playing' && renderGame()}
        {gameState === 'gameover' && renderGameOver()}
      </div>
    </div>
  );
}
