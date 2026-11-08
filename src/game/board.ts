import data from './board.json';
import type { Space } from './types';
import type { GroupKey } from '../config';

export const BOARD_DATA = data as unknown as {
  version: number;
  currency: string;
  goSalary: number;
  spaces: Space[];
};

export const SPACES: Space[] = BOARD_DATA.spaces;
export const GO_SALARY = BOARD_DATA.goSalary;

export function spaceAt(index: number): Space {
  const s = SPACES[index];
  if (!s) throw new Error(`No space at ${index}`);
  return s;
}

/** The single movement calculation. Steps past GO wrap to the front. */
export function advanceTile(from: number, steps: number): number {
  return ((from + steps) % SPACES.length + SPACES.length) % SPACES.length;
}

export function isProperty(space: Space): boolean {
  return space.type === 'property';
}

export function groupMembers(group: GroupKey): Space[] {
  return SPACES.filter((s) => s.group === group && s.type === 'property');
}

export const GROUPS: GroupKey[] = [
  'brown',
  'lightblue',
  'pink',
  'orange',
  'red',
  'yellow',
  'green',
  'darkblue',
];
