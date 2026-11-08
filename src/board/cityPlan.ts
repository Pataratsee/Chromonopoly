import { BOARD } from '../config';

/** Board plus at least one tile of margin. Nothing that looks like a path may enter this. */
export const BOARD_ZONE_HALF = Math.max(7.5, (BOARD.size * BOARD.tile) / 2 + BOARD.frame + BOARD.tile);
export const CITY_HALF = 52;
export const ROAD_WIDTH = 2.8;
export const SIDEWALK = 1.2;
export const PARK_HALF = 7.7;

/** Eight straight streets each way: a Manhattan-style grid, not a ring. */
export const ROAD_LINES = [-41.6, -31.2, -20.8, -10.4, 10.4, 20.8, 31.2, 41.6];

export interface Rect {
  x: number;
  z: number;
  w: number;
  d: number;
}

export interface BuildingSlot {
  x: number;
  z: number;
  size: number;
  rotY: number;
  height: number;
  outer: boolean;
  index: number;
}

export interface MoveRoute {
  axis: 'x' | 'z';
  road: number;
  lane: number;
  dir: 1 | -1;
  speed: number;
  offset: number;
}

function makeRect(x: number, z: number, w: number, d: number): Rect {
  return { x, z, w, d };
}

export const ROAD_RECTS: Rect[] = [
  ...ROAD_LINES.map((x) => makeRect(x, 0, ROAD_WIDTH, CITY_HALF * 2)),
  ...ROAD_LINES.map((z) => makeRect(0, z, CITY_HALF * 2, ROAD_WIDTH)),
];

export function rectIntersectsBoard(rect: Rect, margin = 0): boolean {
  const half = BOARD_ZONE_HALF + margin;
  return Math.abs(rect.x) - rect.w / 2 < half && Math.abs(rect.z) - rect.d / 2 < half;
}

export function pointOutsideBoardZone(x: number, z: number, margin = 0): boolean {
  return Math.abs(x) >= BOARD_ZONE_HALF + margin || Math.abs(z) >= BOARD_ZONE_HALF + margin;
}

export const SIDEWALK_RECTS: Rect[] = (() => {
  const out: Rect[] = [];
  for (const x of ROAD_LINES) {
    for (const side of [-1, 1]) out.push(makeRect(x + side * (ROAD_WIDTH / 2 + SIDEWALK / 2), 0, SIDEWALK, CITY_HALF * 2));
  }
  for (const z of ROAD_LINES) {
    for (const side of [-1, 1]) out.push(makeRect(0, z + side * (ROAD_WIDTH / 2 + SIDEWALK / 2), CITY_HALF * 2, SIDEWALK));
  }
  return out.filter((rect) => !rectIntersectsBoard(rect, 0.01));
})();

/** The strips between streets, including the large central park block. */
export const BLOCK_RECTS: Rect[] = (() => {
  const bounds: Array<[number, number]> = [];
  let previous = -CITY_HALF;
  for (const line of ROAD_LINES) {
    bounds.push([previous, line - ROAD_WIDTH / 2]);
    previous = line + ROAD_WIDTH / 2;
  }
  bounds.push([previous, CITY_HALF]);
  const out: Rect[] = [];
  for (const [x0, x1] of bounds) {
    for (const [z0, z1] of bounds) {
      const rect = makeRect((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0);
      if (!rectIntersectsBoard(rect, 0.2)) out.push(rect);
    }
  }
  return out;
})();

export const PARK_RECTS: Rect[] = BLOCK_RECTS.filter((rect) => {
  const x = Math.abs(rect.x);
  const z = Math.abs(rect.z);
  return (x > 12 && x < 20 && z > 12 && z < 20 && (Math.round(rect.x) + Math.round(rect.z)) % 2 === 0);
});

export function isParkRect(rect: Rect): boolean {
  return PARK_RECTS.some((park) => park.x === rect.x && park.z === rect.z);
}

export const BUILDING_SLOTS: BuildingSlot[] = (() => {
  const out: BuildingSlot[] = [];
  let index = 0;
  for (const rect of BLOCK_RECTS) {
    if (isParkRect(rect)) continue;
    const outer = Math.max(Math.abs(rect.x), Math.abs(rect.z)) > 31;
    const halfW = rect.w / 2 - 0.35;
    const halfD = rect.d / 2 - 0.35;
    if (halfW <= 1 || halfD <= 1) continue;
    // Fill the block edge to edge: three rows downtown, two in the outer
    // district. Shoulder to shoulder, no empty block interiors.
    const size = outer ? 3.0 : 2.3;
    const nx = outer ? 2 : 3;
    const nz = outer ? 2 : 3;
    const dx = (halfW * 2 - size) / (nx - 1);
    const dz = (halfD * 2 - size) / (nz - 1);
    for (let ix = 0; ix < nx; ix += 1) {
      for (let iz = 0; iz < nz; iz += 1) {
        const x = rect.x - halfW + size / 2 + ix * dx;
        const z = rect.z - halfD + size / 2 + iz * dz;
        if (!pointOutsideBoardZone(x, z, size * 0.5)) continue;
        const height = outer ? 0.95 + ((index * 11) % 5) * 0.12 : 0.82 + ((index * 13) % 5) * 0.13;
        out.push({ x, z, size, rotY: 0, height, outer, index });
        index += 1;
      }
    }
  }
  return out;
})();

export const TREE_SLOTS: Array<{ x: number; z: number; size: number }> = (() => {
  const out: Array<{ x: number; z: number; size: number }> = [];
  for (const [i, rect] of PARK_RECTS.entries()) {
    const ring = Math.max(1.1, Math.min(rect.w, rect.d) / 2 - 1.1);
    for (let j = 0; j < 9; j += 1) {
      const a = (j / 9) * Math.PI * 2 + i * 0.3;
      out.push({ x: rect.x + Math.cos(a) * ring, z: rect.z + Math.sin(a) * ring, size: 0.9 + (j % 3) * 0.12 });
    }
  }
  // Park edge around the board, on the square perimeter so every tree stays
  // outside the board zone (a circle at this radius dips inside at the corners).
  const edge = Math.max(BOARD_ZONE_HALF + 1.1, 8.6);
  for (let i = 0; i < 12; i += 1) {
    const t = (i / 12) * 4;
    const side = Math.floor(t);
    const u = (t - side - 0.5) * 2 * edge;
    const p =
      side === 0
        ? { x: u, z: -edge }
        : side === 1
          ? { x: edge, z: u }
          : side === 2
            ? { x: -u, z: edge }
            : { x: -edge, z: -u };
    out.push({ ...p, size: 0.62 + (i % 3) * 0.08 });
  }
  return out;
})();

export const PARKED_CAR_SLOTS: Array<{ x: number; z: number; rotY: number }> = (() => {
  const out: Array<{ x: number; z: number; rotY: number }> = [];
  for (const x of [-20.8, 10.4, 31.2]) {
    for (const z of [-27, -16, 16, 27]) out.push({ x: x + (x > 0 ? 0.75 : -0.75), z, rotY: 0 });
  }
  for (const z of [-20.8, 10.4, 20.8]) {
    for (const x of [-29, -18, 18, 29]) out.push({ x, z: z + (z > 0 ? 0.75 : -0.75), rotY: Math.PI / 2 });
  }
  return out.filter((p) => pointOutsideBoardZone(p.x, p.z, 0.4));
})();

export const CAR_ROUTES: MoveRoute[] = [
  { axis: 'z', road: -20.8, lane: 0.7, dir: 1, speed: 4.2, offset: 0.0 },
  { axis: 'z', road: 10.4, lane: -0.7, dir: -1, speed: 3.6, offset: 0.2 },
  { axis: 'z', road: 31.2, lane: 0.7, dir: 1, speed: 5.0, offset: 0.45 },
  { axis: 'x', road: -10.4, lane: 0.7, dir: -1, speed: 4.5, offset: 0.3 },
  { axis: 'x', road: 20.8, lane: -0.7, dir: 1, speed: 3.8, offset: 0.1 },
  { axis: 'x', road: -31.2, lane: 0.7, dir: 1, speed: 4.8, offset: 0.6 },
];

export const WALK_ROUTES: MoveRoute[] = [
  { axis: 'z', road: -20.8, lane: 2.0, dir: 1, speed: 1.25, offset: 0.1 },
  { axis: 'z', road: 10.4, lane: -2.0, dir: -1, speed: 1.1, offset: 0.4 },
  { axis: 'x', road: -10.4, lane: 2.0, dir: -1, speed: 1.3, offset: 0.2 },
  { axis: 'x', road: 20.8, lane: -2.0, dir: 1, speed: 1.0, offset: 0.55 },
];
