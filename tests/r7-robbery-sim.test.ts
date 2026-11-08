import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { RULES, robberyAmountIssues, robberyChance } from '../src/game/rules';

function simulate(amount: number, runs: number, seed = 12345): number {
  let s = seed >>> 0;
  let wins = 0;
  for (let i = 0; i < runs; i += 1) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const roll = s / 4294967296;
    if (roll < robberyChance(amount)) wins += 1;
  }
  return wins;
}

describe('robbery simulation', () => {
  it('runs 1,000 robberies at each slider end and reports the rates', () => {
    expect(robberyAmountIssues(RULES.robberyMin)).toBeNull();
    expect(robberyAmountIssues(RULES.robberyMax)).toBeNull();
    const low = simulate(50_000, 1000, 7);
    const high = simulate(100_000, 1000, 99);
    const lines = [
      `robberyChance(50000)=${robberyChance(50_000)} -> ${low}/1000 = ${low / 10}%`,
      `robberyChance(100000)=${robberyChance(100_000)} -> ${high}/1000 = ${high / 10}%`,
      `expected 200 and 50 successes; tolerance ±3 sigma`,
    ];
    writeFileSync('docs/round7-proof/robbery-1000.log', lines.join('\n') + '\n');
    expect(low).toBeGreaterThan(165);
    expect(low).toBeLessThan(235);
    expect(high).toBeGreaterThan(25);
    expect(high).toBeLessThan(75);
  });
});
