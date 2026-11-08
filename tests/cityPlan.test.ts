import { describe, expect, it } from 'vitest';
import {
  BLOCK_RECTS,
  BOARD_ZONE_HALF,
  BUILDING_SLOTS,
  PARKED_CAR_SLOTS,
  ROAD_LINES,
  ROAD_RECTS,
  SIDEWALK_RECTS,
  rectIntersectsBoard,
} from '../src/board/cityPlan';

describe('Manhattan street-grid plan', () => {
  it('has straight streets continuing in both directions', () => {
    expect(ROAD_LINES.length).toBe(8);
    expect(ROAD_RECTS).toHaveLength(16);
    for (const road of ROAD_RECTS) {
      expect(Math.max(road.w, road.d)).toBeGreaterThan(100);
    }
  });

  it('keeps every road and sidewalk outside the board plus one-tile margin', () => {
    for (const rect of [...ROAD_RECTS, ...SIDEWALK_RECTS]) {
      expect(rectIntersectsBoard(rect), `${rect.x},${rect.z} ${rect.w}x${rect.d}`).toBe(false);
    }
  });

  it('keeps every building and parked car footprint outside the zone', () => {
    for (const slot of BUILDING_SLOTS) {
      const rect = { x: slot.x, z: slot.z, w: slot.size, d: slot.size };
      expect(rectIntersectsBoard(rect), `building ${slot.index}`).toBe(false);
    }
    for (const car of PARKED_CAR_SLOTS) {
      expect(Math.abs(car.x) > BOARD_ZONE_HALF || Math.abs(car.z) > BOARD_ZONE_HALF).toBe(true);
    }
  });

  it('fills the twelve inner blocks with shoulder-to-shoulder frontage', () => {
    expect(BLOCK_RECTS.length).toBeGreaterThan(20);
    expect(BUILDING_SLOTS.length).toBeGreaterThan(100);
  });
});
