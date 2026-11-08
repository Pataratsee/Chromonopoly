import { describe, expect, it } from 'vitest';
import {
  SPIN_MS,
  rotationAt,
  rotationForPercent,
  segmentAtRotation,
  spinPlan,
  wheelZones,
} from '../src/ui/chanceWheel';

describe('chance wheel landing math', () => {
  it('lands 100 server results on the exact correct segment', () => {
    for (let i = 0; i < 100; i += 1) {
      const percent = 5 + (i * 37) % 91;
      const rollPercent = ((i * 53) % 1000) / 10;
      const zones = wheelZones(percent);
      const target = rotationForPercent(rollPercent);
      const at = segmentAtRotation(target, zones);
      const expected = rollPercent < percent ? 0 : 1;
      expect(at, `spin ${i}: ${rollPercent}% of ${percent}%`).toBe(expected);
      expect(target).toBeGreaterThanOrEqual(0);
      expect(target).toBeLessThan(360);
    }
  });

  it('keeps custom multi-zone outcomes exact', () => {
    const zones = wheelZones(100, [
      { key: 'success', label: 'Success', percent: 55 },
      { key: 'partial', label: 'Partial', percent: 20 },
      { key: 'fail', label: 'Failure', percent: 25 },
    ]);
    for (let i = 0; i < 100; i += 1) {
      const rollPercent = i / 100 * 99.999;
      const at = segmentAtRotation(rotationForPercent(rollPercent), zones);
      const expected = rollPercent < 55 ? 0 : rollPercent < 75 ? 1 : 2;
      expect(at).toBe(expected);
    }
  });

  it('takes 6-10 rotations over 6.8 seconds and ends exactly on the result', () => {
    for (let i = 0; i < 100; i += 1) {
      const percent = (i * 17) % 100;
      const plan = spinPlan(i * 13, percent);
      expect(plan.duration).toBe(SPIN_MS);
      expect(plan.total / 360).toBeGreaterThanOrEqual(6);
      expect(plan.total / 360).toBeLessThanOrEqual(10);
      const final = rotationAt(plan, SPIN_MS);
      expect(final).toBeCloseTo(plan.from + plan.total, 9);
      expect(((final % 360) + 360) % 360).toBeCloseTo(rotationForPercent(percent), 9);
    }
  });
});
