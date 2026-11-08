import { describe, expect, it } from 'vitest';
import { SPACES, spaceAt } from '../src/game/board';
import { BUILDING_META, BUILDING_TYPES } from '../src/game/buildings';
import {
  RULES,
  buildingCost,
  buildingRent,
  canBuild,
  clampPrice,
  dividendSplit,
  emptyTile,
  evidenceStrength,
  evadeChance,
  fundamental,
  groupBuildingCount,
  hasTypeSynergy,
  loanCap,
  loanInterest,
  maxClaim,
  mortgageValue,
  netWorth,
  nextPrice,
  playerTheftChance,
  rentFor,
  robberyChance,
  suitChance,
  unmortgageCost,
} from '../src/game/rules';
import type { PlayerPrivate, TileState } from '../src/game/types';

function tiles(entries: Array<[number, Partial<TileState>]> = []): Record<number, TileState> {
  const out: Record<number, TileState> = {};
  for (const s of SPACES) out[s.index] = emptyTile();
  for (const [idx, patch] of entries) out[idx] = { ...emptyTile(), ...patch };
  return out;
}

describe('board data', () => {
  it('has all 40 canonical spaces in clockwise order', () => {
    expect(SPACES).toHaveLength(40);
    for (const [i, s] of SPACES.entries()) expect(s.index).toBe(i);
    expect(spaceAt(0).name).toBe('GO');
    expect(spaceAt(39).name).toBe('Boardwalk');
  });

  it('uses the exact brief rents and prices', () => {
    expect(spaceAt(1)).toMatchObject({ price: 60, rents: [2, 10, 30, 90, 160, 250], buildCost: 50, mortgage: 30 });
    expect(spaceAt(39)).toMatchObject({ price: 400, rents: [50, 200, 600, 1400, 1700, 2000], buildCost: 200, mortgage: 200 });
    expect(spaceAt(19)).toMatchObject({ price: 200, rents: [16, 80, 220, 600, 800, 1000], buildCost: 100, mortgage: 100 });
    expect(spaceAt(37)).toMatchObject({ price: 350, rents: [35, 175, 500, 1100, 1300, 1500], buildCost: 200, mortgage: 175 });
  });
});

describe('rent', () => {
  it('quotes base rent for a single property', () => {
    const t = tiles([[1, { ownerId: 'a' }]]);
    expect(rentFor(1, t, 7)).toBe(2);
  });

  it('doubles base rent when the full colour group is held', () => {
    const t = tiles([
      [1, { ownerId: 'a' }],
      [3, { ownerId: 'a' }],
    ]);
    expect(rentFor(1, t, 7)).toBe(4);
    expect(rentFor(3, t, 7)).toBe(8);
  });

  it('does not charge rent while mortgaged', () => {
    const t = tiles([[1, { ownerId: 'a', mortgaged: true }]]);
    expect(rentFor(1, t, 7)).toBe(0);
  });

  it('scales railroad rent by the number owned', () => {
    const t = tiles([
      [5, { ownerId: 'a' }],
      [15, { ownerId: 'a' }],
      [25, { ownerId: 'a' }],
    ]);
    expect(rentFor(5, t, 7)).toBe(100);
  });

  it('uses 4x then 10x dice for utilities', () => {
    const one = tiles([[12, { ownerId: 'a' }]]);
    expect(rentFor(12, one, 9)).toBe(36);
    const two = tiles([
      [12, { ownerId: 'a' }],
      [28, { ownerId: 'a' }],
    ]);
    expect(rentFor(12, two, 9)).toBe(90);
  });

  it('applies building rent for each type', () => {
    const t = tiles([[1, { ownerId: 'a', building: 'house' }]]);
    expect(rentFor(1, t, 7)).toBe(10);
    t[1]!.building = 'apartments';
    expect(rentFor(1, t, 7)).toBe(4);
    t[1]!.building = 'office';
    expect(rentFor(1, t, 7)).toBe(8);
    t[1]!.building = 'hotel';
    expect(rentFor(1, t, 7)).toBe(250);
    t[1]!.building = 'landmark';
    expect(rentFor(1, t, 7)).toBe(26);
  });

  it('adds the shop and restaurant synergy only across the full group', () => {
    const base = tiles([[1, { ownerId: 'a', building: 'corner_shop' }]]);
    expect(buildingRent(spaceAt(1), 'corner_shop', base)).toBe(4);
    const syn = tiles([
      [1, { ownerId: 'a', building: 'corner_shop' }],
      [3, { ownerId: 'a', building: 'corner_shop' }],
    ]);
    expect(hasTypeSynergy(1, 'corner_shop', syn)).toBe(true);
    expect(buildingRent(spaceAt(1), 'corner_shop', syn)).toBe(4);
    const restaurant = tiles([
      [1, { ownerId: 'a', building: 'restaurant' }],
      [3, { ownerId: 'a', building: 'restaurant' }],
    ]);
    expect(buildingRent(spaceAt(1), 'restaurant', restaurant)).toBe(Math.round(2 * 3 * 1.1));
  });

  it('charges build cost multiples exactly', () => {
    expect(buildingCost(spaceAt(1), 'house')).toBe(50);
    expect(buildingCost(spaceAt(1), 'apartments')).toBe(90);
    expect(buildingCost(spaceAt(1), 'corner_shop')).toBe(70);
    expect(buildingCost(spaceAt(1), 'restaurant')).toBe(110);
    expect(buildingCost(spaceAt(1), 'office')).toBe(150);
    expect(buildingCost(spaceAt(1), 'hotel')).toBe(250);
    expect(buildingCost(spaceAt(1), 'landmark')).toBe(450);
  });

  it('ships 32 unique building types and models', () => {
    expect(BUILDING_TYPES).toHaveLength(32);
    const models = BUILDING_TYPES.map((type) => BUILDING_META[type].model);
    expect(new Set(models).size).toBe(BUILDING_TYPES.length);
  });

  it('lets multiplayer build any owned street but keeps solo group rules', () => {
    const one = tiles([[1, { ownerId: 'a' }]]);
    expect(canBuild(1, one, 'a', 0, 'multi', 'corner_shop').ok).toBe(true);
    expect(canBuild(1, one, 'a', 0, 'solo', 'house').ok).toBe(false);
    const group = tiles([[1, { ownerId: 'a' }], [3, { ownerId: 'a' }]]);
    expect(canBuild(1, group, 'a', 0, 'solo', 'house').ok).toBe(true);
  });
});

describe('mortgage and loans', () => {
  it('mortgages at 50% and unmortgages at +10%', () => {
    expect(mortgageValue(spaceAt(1))).toBe(30);
    expect(unmortgageCost(spaceAt(1))).toBe(33);
    expect(mortgageValue(spaceAt(39))).toBe(200);
    expect(unmortgageCost(spaceAt(39))).toBe(220);
  });

  it('computes interest as 2% rounded up', () => {
    expect(loanInterest(200)).toBe(4);
    expect(loanInterest(1000)).toBe(20);
    expect(loanInterest(1)).toBe(1);
  });

  it('floors the loan cap at $10,000 and then follows net worth', () => {
    expect(loanCap(0)).toBe(10_000);
    expect(loanCap(1000)).toBe(10_000);
    expect(loanCap(10_000)).toBe(30_000);
    expect(loanCap(14_999)).toBe(44_950);
  });

  it('counts cash, deeds, buildings and shares in net worth', () => {
    const player = {
      id: 'a',
      cash: 100,
      holdings: { '1': 500 },
    } as unknown as PlayerPrivate;
    const t = tiles([[1, { ownerId: 'a', building: 'house' }]]);
    const worth = netWorth(player, t, { 1: 120 });
    expect(worth).toBe(100 + 60 + 25 + 60);
  });
});

describe('stock market', () => {
  it('bounds every move to 0.2x–8x fundamental', () => {
    const fund = 200;
    for (const start of [1, 50, 200, 9000]) {
      for (const volume of [-100000, -400, 0, 400, 100000]) {
        const price = nextPrice(start, fund, volume, () => 0.5);
        expect(price).toBeGreaterThanOrEqual(fund * RULES.stockFloor - 1e-9);
        expect(price).toBeLessThanOrEqual(fund * RULES.stockCeiling + 1e-9);
        expect(Number.isFinite(price)).toBe(true);
      }
    }
    expect(clampPrice(10, 100)).toBe(20);
    expect(clampPrice(10000, 100)).toBe(800);
  });

  it('tracks fundamental from rent yield and building level', () => {
    const t = tiles();
    const plain = fundamental(1, t);
    t[1]!.ownerId = 'a';
    t[1]!.building = 'hotel';
    expect(fundamental(1, t)).toBeGreaterThan(plain);
  });

  it('splits rent with external holders, never below half to the owner', () => {
    const { owner, holders } = dividendSplit(1000, { ext: 0.4 });
    expect(holders.ext).toBe(400);
    expect(owner).toBe(600);
    const capped = dividendSplit(1000, { ext: 0.9 });
    expect(capped.holders.ext).toBe(500);
    expect(capped.owner).toBe(500);
  });
});

describe('crime and justice', () => {
  it('sets robbery odds from 20% at $50k down to 5% at $100k', () => {
    expect(robberyChance(50_000)).toBeCloseTo(0.2, 6);
    expect(robberyChance(100_000)).toBeCloseTo(0.05, 6);
    expect(robberyChance(75_000)).toBeCloseTo(0.125, 6);
    let previous = robberyChance(50_000);
    for (let amount = 51_000; amount <= 100_000; amount += 1000) {
      const next = robberyChance(amount);
      expect(next).toBeLessThan(previous);
      previous = next;
    }
    expect(robberyChance(10_000)).toBeCloseTo(0.2, 6);
    expect(robberyChance(200_000)).toBeCloseTo(0.05, 6);
    expect(playerTheftChance()).toBe(0.55);
  });

  it('reduces evasion odds by 15% per building', () => {
    expect(evadeChance(0)).toBe(0.6);
    expect(evadeChance(1)).toBeCloseTo(0.45, 5);
    expect(evadeChance(9)).toBe(0.05);
  });

  it('builds evidence from unpaid rent and findings, capped at 10', () => {
    expect(evidenceStrength(0, 0)).toBe(0);
    expect(evidenceStrength(250, 0)).toBe(2);
    expect(evidenceStrength(250, 1)).toBe(4);
    expect(evidenceStrength(100000, 10)).toBe(10);
  });

  it('caps court odds and claims', () => {
    expect(suitChance(0)).toBe(0.35);
    expect(suitChance(10)).toBe(0.85);
    expect(suitChance(100)).toBe(0.85);
    expect(maxClaim(1)).toBe(500);
    expect(maxClaim(10)).toBe(5000);
  });
});

describe('board consistency', () => {
  it('counts buildings for the 60 plot cap', () => {
    const t = tiles([
      [1, { ownerId: 'a', building: 'house' }],
      [3, { ownerId: 'a', building: 'corner_shop' }],
    ]);
    expect(groupBuildingCount(t)).toBe(2);
  });

  it('has a price and a mortgage for every purchasable space', () => {
    for (const s of SPACES) {
      if (s.price > 0) {
        expect(s.mortgage).toBeGreaterThan(0);
        expect(s.mortgage).toBe(Math.round(s.price * 0.5));
      }
    }
  });
});
