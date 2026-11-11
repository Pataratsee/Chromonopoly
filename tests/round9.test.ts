import { describe, expect, it } from 'vitest';
import { World } from '../server/world';
import { emptyTile, multiplayerRent, RULES, upgradeCost } from '../src/game/rules';
import { buildSlots } from '../src/game/buildings';
import { normalizeUsername, usernameIssue } from '../src/game/username';
import { spaceAt } from '../src/game/board';
import type { TileState } from '../src/game/types';

function worldAt(clock = { value: 1_000_000 }) {
  const world = new World({ mode: 'multi', rng: () => 0.42, now: () => clock.value });
  for (const p of world.players.values()) p.isBot = false;
  return { world, clock };
}

function tiles(entries: Array<[number, Partial<TileState>]>): Record<number, TileState> {
  const out: Record<number, TileState> = {};
  for (const [index, patch] of entries) out[index] = { ...emptyTile(), ...patch };
  return out;
}

describe('W1 username and reclaim token', () => {
  it('normalizes and rejects empty, long and offensive names', () => {
    expect(normalizeUsername('  Ada  Lovelace ')).toBe('Ada Lovelace');
    expect(usernameIssue('ab')).toBeTruthy();
    expect(usernameIssue('a'.repeat(17))).toBeTruthy();
    expect(usernameIssue('fuck')).toBeTruthy();
    expect(usernameIssue('Ada_1')).toBeNull();
  });

  it('rejects a duplicate name and a wrong token, then reclaims with the right token', () => {
    const { world } = worldAt();
    const first = world.join('Ada', 'dog', '', 'a'.repeat(32));
    expect(() => world.join('ada', 'cat', '', 'b'.repeat(32))).toThrow(/already taken/i);
    world.disconnect(first.player.id);
    expect(() => world.join('ADA', 'cat', '', 'b'.repeat(32))).toThrow(/already taken/i);
    const reclaimed = world.join('ada', 'cat', '', 'a'.repeat(32));
    expect(reclaimed.player.id).toBe(first.player.id);
    expect(reclaimed.player.online).toBe(true);
  });

  it('releases a name with no cash, loan or property', () => {
    const { world } = worldAt();
    const first = world.join('Ada', 'dog', '', 'a'.repeat(32));
    first.player.cash = 0;
    world.disconnect(first.player.id);
    const second = world.join('Ada', 'cat', '', 'b'.repeat(32));
    expect(second.player.id).not.toBe(first.player.id);
  });

  it('sells the cheapest deed per offline hour and catches up', () => {
    const { world, clock } = worldAt();
    const p = world.join('Ada', 'dog', '', 'a'.repeat(32));
    p.player.cash = 5000;
    for (const index of [1, 3, 6, 8, 9, 11]) world.tiles[index]!.ownerId = p.player.id;
    world.tiles[1]!.buildings = [{ type: 'house', rank: 1 }];
    world.disconnect(p.player.id);
    clock.value += RULES.offlineSaleMs * 5;
    world.processOfflineSales();
    expect(world.tiles[1]!.ownerId).toBeNull();
    expect(world.tiles[3]!.ownerId).toBeNull();
    expect(world.tiles[6]!.ownerId).toBeNull();
    expect(world.tiles[8]!.ownerId).toBeNull();
    expect(world.tiles[9]!.ownerId).toBeNull();
    expect(world.tiles[11]!.ownerId).toBe(p.player.id);
    expect(p.player.cash).toBe(5000 + 25);
  });

  it('never broadcasts a token or token hash', () => {
    const { world } = worldAt();
    const p = world.join('Ada', 'dog', '', 'secret'.repeat(8));
    const wire = JSON.stringify(world.publicState()) + JSON.stringify(world.privateState(p.player.id));
    expect(wire).not.toContain('secretsecret');
    expect(wire).not.toContain(p.player.tokenHash);
  });
});

describe('W3 loans', () => {
  it('refuses a second loan until the first is fully repaid', () => {
    const { world } = worldAt();
    const p = world.join('Ada', 'dog');
    p.player.cash = 20_000;
    expect(world.intent(p.player.id, { t: 'loan', amount: 5000, key: 'l1' }).ok).toBe(true);
    expect(world.intent(p.player.id, { t: 'loan', amount: 10, key: 'l2' })).toEqual({
      ok: false,
      reason: 'Repay your current loan first.',
    });
    expect(world.intent(p.player.id, { t: 'repayLoan', amount: 5000, key: 'r1' }).ok).toBe(true);
    expect(world.intent(p.player.id, { t: 'loan', amount: 5000, key: 'l3' }).ok).toBe(true);
  });
});

describe('W8/W9 building slots and payer-cash rent', () => {
  it('gives every property three slots and charges 1x/3x/9x/27x upgrades', () => {
    expect(buildSlots(spaceAt(1))).toBe(3);
    expect(buildSlots(spaceAt(39))).toBe(3);
    expect(upgradeCost(spaceAt(1), 'house', 2)).toBe(150);
    expect(upgradeCost(spaceAt(1), 'house', 3)).toBe(450);
    expect(upgradeCost(spaceAt(1), 'house', 4)).toBe(1350);
  });

  it('builds three slots including duplicates, upgrades independently and refuses a fourth', () => {
    const { world } = worldAt();
    const p = world.join('Ada', 'dog');
    p.player.cash = 1_000_000;
    world.tiles[39]!.ownerId = p.player.id;
    for (const [index, type] of (['house', 'apartments', 'house'] as const).entries()) {
      expect(world.intent(p.player.id, { t: 'build', tile: 39, type, key: `b-${type}-${index}` }).ok).toBe(true);
    }
    expect(world.tiles[39]!.buildings).toHaveLength(3);
    expect(world.intent(p.player.id, { t: 'build', tile: 39, type: 'landmark', key: 'b5' }).ok).toBe(false);
    expect(world.intent(p.player.id, { t: 'upgrade', tile: 39, type: 'house', slot: 2, key: 'u1' }).ok).toBe(true);
    expect(world.tiles[39]!.buildings[0]!.rank).toBe(1);
    expect(world.tiles[39]!.buildings[2]!.rank).toBe(2);
  });

  it('matches the documented payer-cash percentages and prestige', () => {
    const one = tiles([[39, { ownerId: 'a', buildings: [{ type: 'house', rank: 1 }] }]]);
    expect(multiplayerRent(39, one, 1_000_000).rent).toBe(10_000);
    const four = tiles([[39, { ownerId: 'a', buildings: [{ type: 'house', rank: 4 }] }]]);
    expect(multiplayerRent(39, four, 1_000_000).rent).toBe(400_000);
    const twoMax = tiles([[39, {
      ownerId: 'a',
      buildings: [{ type: 'house', rank: 4 }, { type: 'office', rank: 4 }],
    }]]);
    expect(multiplayerRent(39, twoMax, 1_000_000).percent).toBeCloseTo(0.55, 6);
    expect(multiplayerRent(39, twoMax, 1_000_000).rent).toBe(550_000);
    expect(multiplayerRent(39, tiles([[39, { ownerId: 'a' }]]), 0).rent).toBe(Math.max(10, spaceAt(39).rents[0]!));
  });
});
