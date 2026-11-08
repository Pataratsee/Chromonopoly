import { describe, expect, it } from 'vitest';
import { advanceTile } from '../src/game/board';
import { tilePose } from '../src/board/layout';
import { BOARD } from '../src/config';

describe('one tile index -> one board position', () => {
  it('maps all 40 tiles to distinct finite centers on the board ring', () => {
    const seen = new Map<string, number>();
    for (let index = 0; index < 40; index += 1) {
      const p = tilePose(index);
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.z)).toBe(true);
      const key = `${p.x.toFixed(5)},${p.z.toFixed(5)}`;
      expect(seen.has(key)).toBe(false);
      seen.set(key, index);
      const onEdge = Math.abs(Math.abs(p.x) - 5.25) < 1e-9 || Math.abs(Math.abs(p.z) - 5.25) < 1e-9;
      expect(onEdge).toBe(true);
    }
    expect(seen.size).toBe(40);
  });

  it('wraps GO and lands on Jail with the same mapping every renderer uses', () => {
    expect(advanceTile(39, 2)).toBe(1);
    expect(advanceTile(38, 12)).toBe(10);
    expect(advanceTile(8, 2)).toBe(10);
    expect(tilePose(0)).toMatchObject({ x: 5.25, z: 5.25 });
    expect(tilePose(10)).toMatchObject({ x: -5.25, z: 5.25 });
    expect(tilePose(20)).toMatchObject({ x: -5.25, z: -5.25 });
    expect(tilePose(30)).toMatchObject({ x: 5.25, z: -5.25 });
  });

  it('keeps adjacent tiles exactly one tile apart, including across corners', () => {
    for (let index = 0; index < 40; index += 1) {
      const a = tilePose(index);
      const b = tilePose((index + 1) % 40);
      const distance = Math.hypot(a.x - b.x, a.z - b.z);
      expect(distance).toBeCloseTo(BOARD.tile, 9);
    }
  });

  it('ends every start 0-39 and every dice total 2-12 on that tile center', () => {
    for (let start = 0; start < 40; start += 1) {
      for (let total = 2; total <= 12; total += 1) {
        const logicTile = advanceTile(start, total);
        expect(logicTile).toBeGreaterThanOrEqual(0);
        expect(logicTile).toBeLessThan(40);
        const center = tilePose(logicTile);
        expect(center).toEqual(tilePose(logicTile));
      }
    }
  });
});
