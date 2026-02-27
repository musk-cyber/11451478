/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type GameMode = 'classic' | 'time';
export type GameState = 'menu' | 'playing' | 'gameover';

export interface BlockData {
  id: string;
  value: number;
  color: string;
}

export const GRID_WIDTH = 6;
export const GRID_HEIGHT = 10;
export const INITIAL_ROWS = 4;
export const MAX_VALUE = 9;
export const MIN_VALUE = 1;

export const COLORS = [
  'bg-blue-600',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-indigo-600',
  'bg-violet-600',
  'bg-cyan-600',
  'bg-orange-600',
];

export function getRandomValue(): number {
  return Math.floor(Math.random() * (MAX_VALUE - MIN_VALUE + 1)) + MIN_VALUE;
}

export function getRandomColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}
