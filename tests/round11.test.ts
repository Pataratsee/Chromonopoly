import { describe, expect, it } from 'vitest';
import { buildSlots, duplicateFactor, BUILD_SLOTS, DUPLICATE_RETURN_FACTORS } from '../src/game/buildings';
import { RULES, multiplayerRent } from '../src/game/rules';
import { perksForOwner } from '../src/game/perks';
import { World } from '../server/world';
import type { Building, TileState } from '../src/game/types';

function tile(ownerId: string, buildings: Building[]): TileState {
  return { ownerId, mortgaged: false, buildings, shares: {}, lockedBy: null };
}

describe('Round 11: three slots and duplicate returns', () => {
  it('gives every property exactly three slots', () => {
    expect(BUILD_SLOTS).toBe(3);
    expect(buildSlots({ price: 60 })).toBe(3);
    expect(buildSlots({ price: 400 })).toBe(3);
  });

  it('diminishes only repeated copies of the same type', () => {
    const repeated = [{ type: 'house' }, { type: 'house' }, { type: 'house' }];
    expect(duplicateFactor(repeated, 0)).toBe(DUPLICATE_RETURN_FACTORS[0]);
    expect(duplicateFactor(repeated, 1)).toBe(0.7);
    expect(duplicateFactor(repeated, 2)).toBe(0.5);
    expect(duplicateFactor([{ type: 'house' }, { type: 'office' }], 1)).toBe(1);
  });

  it('applies duplicate factors to perks and rent, so copies never beat mixed types', () => {
    const repeated = { 39: tile('a', [{ type: 'house', rank: 1 }, { type: 'house', rank: 1 }, { type: 'house', rank: 1 }]) };
    const mixed = { 39: tile('a', [{ type: 'house', rank: 1 }, { type: 'office', rank: 1 }, { type: 'park', rank: 1 }]) };
    expect(perksForOwner('a', repeated).incomePerTurn).toBeLessThan(3 * 0.02 * 40);
    expect(multiplayerRent(39, repeated, 1_000_000).percent).toBeLessThan(multiplayerRent(39, mixed, 1_000_000).percent);
  });
});

describe('Round 11: jail release is 10% with a $50 floor', () => {
  it('never returns zero and matches the live displayed amount', () => {
    const world = new World({ mode: 'multi', rng: () => 0.5, now: () => 100_000 });
    const player = world.join('Bail', 'dog');
    player.player.inJail = true;
    player.player.jailTurns = 3;
    expect(RULES.jailFeeRate).toBe(0.1);
    for (const cash of [0, 10, 499, 500, 1_000, 1_000_000, 1_000_000_000]) {
      player.player.cash = cash;
      const displayed = world.privateState(player.player.id).you.jailReleaseCost;
      const charged = Math.max(RULES.jailFeeMin, Math.round(cash * RULES.jailFeeRate));
      expect(displayed).toBe(charged);
      expect(displayed).toBeGreaterThanOrEqual(50);
    }
  });
});
