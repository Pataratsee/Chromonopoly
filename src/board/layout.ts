import { BOARD } from '../config';
import { SPACES } from '../game/board';
import type { Space } from '../game/types';

/**
 * The only tile-index -> board-position mapping in the project. Every system
 * (tiles, tokens, camera, buildings, signs, cards and highlights) uses this.
 * The board plane lies in XZ; `rotY` makes a tile's labels read from its side.
 */
export interface TilePose {
  x: number;
  z: number;
  rotY: number;
  side: 'bottom' | 'left' | 'top' | 'right';
  corner: boolean;
}

const CENTER = (BOARD.size * BOARD.tile) / 2 - BOARD.tile / 2;

export function tilePose(index: number): TilePose {
  const center = CENTER;
  if (index === 0) return { x: center, z: center, rotY: 0, side: 'bottom', corner: true };
  if (index < 10) return { x: center - index * BOARD.tile, z: center, rotY: 0, side: 'bottom', corner: false };
  if (index === 10) return { x: -center, z: center, rotY: -Math.PI / 2, side: 'left', corner: true };
  if (index < 20) return { x: -center, z: center - (index - 10) * BOARD.tile, rotY: -Math.PI / 2, side: 'left', corner: false };
  if (index === 20) return { x: -center, z: -center, rotY: Math.PI, side: 'top', corner: true };
  if (index < 30) return { x: -center + (index - 20) * BOARD.tile, z: -center, rotY: Math.PI, side: 'top', corner: false };
  if (index === 30) return { x: center, z: -center, rotY: Math.PI / 2, side: 'right', corner: true };
  return { x: center, z: -center + (index - 30) * BOARD.tile, rotY: Math.PI / 2, side: 'right', corner: false };
}

export const TILE_COUNT = SPACES.length;

export function HAS_BAND(space: Space): boolean {
  return space.type === 'property' || space.type === 'railroad' || space.type === 'utility';
}

/** The compact name printed on a tile; the sheet always keeps the full name. */
const BOARD_NAMES: Record<string, string> = {
  'Mediterranean Ave': 'Mediterranean',
  'Connecticut Ave': 'Connecticut',
  'St. Charles Place': 'St. Charles',
  'St. James Place': 'St. James',
  'North Carolina Ave': 'N. Carolina Ave',
  'Pennsylvania Ave': 'Pennsylvania',
  'Reading Railroad': 'Reading RR',
  'B. & O. Railroad': 'B&O RR',
  'Electric Company': 'Electric Co.',
};

export function boardName(space: Space): string {
  return BOARD_NAMES[space.name] ?? space.name;
}

/** Content box for a tile's text, in tile-local units (tile = 1). */
export function contentBox(space: Space): { w: number; h: number } {
  const band = HAS_BAND(space) ? 0.2 : 0;
  const icon = space.type === 'property' || space.type === 'railroad' || space.type === 'utility' ? 0 : 0.24;
  return { w: 0.94, h: 0.84 - band - icon };
}
