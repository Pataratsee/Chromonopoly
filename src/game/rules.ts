import { SPACES, spaceAt, groupMembers } from './board';
import { BUILDING_CATALOG, BUILDING_META, BUILDING_TYPES, BUILDING_CATEGORIES, buildingTypesForMode, buildSlots, type BuildingType } from './buildings';
import type { Building, GameMode, PlayerPrivate, Space, TileState } from './types';

export { BUILDING_CATALOG, BUILDING_META, BUILDING_TYPES, BUILDING_CATEGORIES, buildingTypesForMode, buildSlots };

/** Every economic number the brief fixes. Nothing else may hardcode these. */
export const RULES = {
  goSalary: 200,
  mortgageRate: 0.5,
  unmortgagePremium: 0.1,
  sellRefund: 0.5,
  loanInterest: 0.02,
  loanMaxMultiple: 3,
  loanMinimum: 200,
  stockStartMultiple: 8,
  // W12 measured: a smaller drift and wider noise keep most random traders
  // slightly negative while leaving a meaningful profitable minority and rare
  // +25% runs. Costs are half a percent per side.
  stockDrift: -0.002,
  stockNoise: 0.05,
  stockFee: 0.005,
  stockSpread: 0.005,
  stockDailyRiseCap: 0.2,
  stockTickCap: 0.06,
  stockFloor: 0.2,
  stockCeiling: 8,
  externalMax: 0.5,
  robberyMin: 50_000,
  robberyMax: 100_000,
  robberyMinChance: 0.2,
  robberyMaxChance: 0.05,
  playerTheftBase: 0.55,
  playerTheftCap: 800,
  jailAllChance: 0.25,
  jailSomeChance: 0.4,
  murderChance: 0.05,
  murderCaughtChance: 0.7,
  murderFine: 1000,
  murderAttemptRep: 15,
  murderSuccessRep: 45,
  murderCaughtRep: 25,
  hospitalTurns: 3,
  murderCooldownMs: 30_000,
  theftRepLoss: 25,
  theftAttemptRep: 15,
  evadeBase: 0.6,
  evadePerBuilding: 0.15,
  evadePenalty: 0.2,
  evadeSuccessRep: 5,
  evadeCaughtRep: 10,
  payRentRep: 1,
  detectiveFee: 10_000,
  detectiveChance: 0.6,
  evidencePerFinding: 2,
  evidenceCap: 10,
  suitBaseChance: 0.35,
  suitPerStrength: 0.05,
  suitChanceCap: 0.85,
  suitFees: 200,
  suitLoss: 150,
  suitLossRep: 10,
  suitWinRep: 5,
  settleMultiple: 1.5,
  maxBuildings: 60,
  jailTurns: 3,
  jailRepOnEntry: 0,
  buildingRanks: 4,
  rankRentPct: [0.01, 0.05, 0.1, 0.4],
  extraBuildingPct: 0.1,
  prestigePerRank4: 0.25,
  multiRentMin: 10,
  wipeCost: 500_000,
  wipeChance: 0.15,
  wipeReputation: 50,
  offlineSaleMs: 60 * 60 * 1000,
} as const;

export function buildingCost(space: Space, type: BuildingType): number {
  if (space.buildCost <= 0) throw new Error(`${space.name} cannot be built on`);
  return Math.round(space.buildCost * BUILDING_META[type].costMultiple);
}

/** Cost to take one building from rank-1 to rank-2/3/4: 3x, 9x, 27x base. */
export function upgradeCost(space: Space, type: BuildingType, targetRank: 2 | 3 | 4): number {
  return Math.round(buildingCost(space, type) * 3 ** (targetRank - 1));
}

export function buildingInvested(space: Space, building: Building): number {
  let total = buildingCost(space, building.type);
  for (let rank = 2; rank <= building.rank; rank += 1) {
    total += upgradeCost(space, building.type, rank as 2 | 3 | 4);
  }
  return total;
}

export function buildingRentLabel(type: BuildingType): string {
  const meta = BUILDING_META[type];
  if (type === 'house') return 'Printed 1-house rent';
  if (type === 'hotel') return 'Printed hotel rent';
  return `${meta.rentMultiple}x base rent · +10% full-group synergy`;
}

export function emptyTile(): TileState {
  return { ownerId: null, mortgaged: false, buildings: [], shares: {}, lockedBy: null };
}

/** True when `ownerId` holds every property in the colour group. */
export function ownsGroup(group: Space['group'], ownerId: string, tiles: Record<number, TileState>): boolean {
  if (!group) return false;
  const members = groupMembers(group);
  return members.length > 0 && members.every((s) => tiles[s.index]?.ownerId === ownerId);
}

/** +10% / +15% synergy when every property in the group carries the same type. */
export function hasTypeSynergy(tile: number, type: BuildingType, tiles: Record<number, TileState>): boolean {
  const space = spaceAt(tile);
  const ownerId = tiles[tile]?.ownerId;
  if (!space.group || !ownerId) return false;
  const members = groupMembers(space.group);
  return members.every((s) =>
    tiles[s.index]?.ownerId === ownerId && tiles[s.index]?.buildings.some((b) => b.type === type),
  );
}

/** Rent with no building, before railroad/utility special cases. */
export function baseRent(space: Space, ownerId: string | null, tiles: Record<number, TileState>, solo = true): number {
  if (!space.rents.length) return 0;
  const base = space.rents[0] ?? 0;
  if (solo && ownerId && ownsGroup(space.group, ownerId, tiles) && !tiles[space.index]?.buildings.length) {
    return base * 2;
  }
  return base;
}

/** Solo Monopoly rent. Multiplayer uses payer-cash rent below. */
export function buildingRent(space: Space, type: BuildingType, tiles: Record<number, TileState>): number {
  const base = space.rents[0] ?? 0;
  const hotel = space.rents[5] ?? 0;
  if (type === 'house') return space.rents[1] ?? base;
  if (type === 'hotel') return hotel;
  const synergy = hasTypeSynergy(space.index, type, tiles) ? 1.1 : 1;
  return Math.round(base * BUILDING_META[type].rentMultiple * synergy);
}

export interface MultiRentBreakdown {
  percent: number;
  rent: number;
  highestRank: number;
  buildings: number;
  prestige: number;
}

/** W9: rank percentages, +10% of the percentage per extra building, prestige per extra rank-4. */
export function multiplayerRent(
  tile: number,
  tiles: Record<number, TileState>,
  payerCash: number,
): MultiRentBreakdown {
  const space = spaceAt(tile);
  const state = tiles[tile];
  const empty = { percent: 0, rent: RULES.multiRentMin, highestRank: 0, buildings: 0, prestige: 1 };
  if (!state || !space.rents.length) return empty;
  if (!state.buildings.length) {
    return { ...empty, rent: Math.max(RULES.multiRentMin, space.rents[0] ?? 0) };
  }
  const highestRank = Math.max(...state.buildings.map((b) => b.rank));
  const rank4 = state.buildings.filter((b) => b.rank === 4).length;
  const basePercent = RULES.rankRentPct[highestRank - 1] ?? 0;
  const buildingFactor = 1 + RULES.extraBuildingPct * Math.max(0, state.buildings.length - 1);
  const prestige = 1 + RULES.prestigePerRank4 * Math.max(0, rank4 - 1);
  const percent = basePercent * buildingFactor * prestige;
  const cash = Math.max(0, Math.floor(payerCash));
  return {
    percent,
    rent: Math.max(RULES.multiRentMin, Math.floor(cash * percent)),
    highestRank,
    buildings: state.buildings.length,
    prestige,
  };
}

/**
 * The rent a visitor owes. `dice` is the committed roll (for utilities),
 * `null` when rent is being quoted outside a landing. Passing `payerCash`
 * switches to the multiplayer inflation formula.
 */
export function rentFor(
  tile: number,
  tiles: Record<number, TileState>,
  dice: number | null,
  ownerId: string | null = tiles[tile]?.ownerId ?? null,
  payerCash: number | null = null,
): number {
  const space = spaceAt(tile);
  const state = tiles[tile];
  if (!state || !ownerId || state.mortgaged) return 0;
  if (space.type === 'railroad') {
    const count = SPACES.filter((s) => s.type === 'railroad' && tiles[s.index]?.ownerId === ownerId).length;
    return space.rents[Math.max(0, Math.min(3, count - 1))] ?? 0;
  }
  if (space.type === 'utility') {
    const count = SPACES.filter((s) => s.type === 'utility' && tiles[s.index]?.ownerId === ownerId).length;
    const multiple = count >= 2 ? 10 : 4;
    return (dice ?? 0) * multiple;
  }
  if (space.type !== 'property') return 0;
  if (payerCash !== null) return multiplayerRent(tile, tiles, payerCash).rent;
  const highest = state.buildings.reduce<Building | null>(
    (best, b) => (!best || b.rank > best.rank ? b : best),
    null,
  );
  if (highest) return buildingRent(space, highest.type, tiles);
  return baseRent(space, ownerId, tiles, true);
}

export function groupBuildingCount(tiles: Record<number, TileState>): number {
  return Object.values(tiles).reduce((total, tile) => total + tile.buildings.length, 0);
}

export function canBuild(
  tile: number,
  tiles: Record<number, TileState>,
  ownerId: string,
  totalBuildings: number,
  mode: GameMode = 'multi',
  type?: BuildingType,
): { ok: true } | { ok: false; reason: string } {
  const space = spaceAt(tile);
  const state = tiles[tile];
  if (!state || state.ownerId !== ownerId) return { ok: false, reason: 'You do not own this property.' };
  if (space.type !== 'property') return { ok: false, reason: 'Only streets can be built on.' };
  if (state.mortgaged) return { ok: false, reason: 'Unmortgage this property first.' };
  if (mode === 'solo') {
    if (type && type !== 'house' && type !== 'hotel') {
      return { ok: false, reason: 'Solo uses standard Monopoly rules: houses and hotels only.' };
    }
    if (!ownsGroup(space.group, ownerId, tiles)) return { ok: false, reason: 'You need the full colour group.' };
    const mortgagedInGroup = groupMembers(space.group!).some((s) => tiles[s.index]?.mortgaged);
    if (mortgagedInGroup) return { ok: false, reason: 'A property in this group is mortgaged.' };
    if (state.buildings.length >= 1) return { ok: false, reason: 'Sell the existing house or hotel first.' };
  } else {
    if (state.buildings.length >= buildSlots(space)) {
      return { ok: false, reason: `All ${buildSlots(space)} build slots on ${space.name} are used.` };
    }
    if (type && state.buildings.some((b) => b.type === type)) {
      return { ok: false, reason: `${BUILDING_META[type].name} is already on this property.` };
    }
  }
  if (state.lockedBy) return { ok: false, reason: 'This property is locked by a pending deal.' };
  if (totalBuildings >= RULES.maxBuildings) {
    return { ok: false, reason: `The board is full — all ${RULES.maxBuildings} building plots are taken.` };
  }
  return { ok: true };
}

export function mortgageValue(space: Space): number {
  return Math.round(space.price * RULES.mortgageRate);
}

export function unmortgageCost(space: Space): number {
  return Math.round(mortgageValue(space) * (1 + RULES.unmortgagePremium));
}

export function netWorth(player: PlayerPrivate, tiles: Record<number, TileState>, prices: Record<number, number>): number {
  let total = player.cash;
  for (const [idx, t] of Object.entries(tiles)) {
    if (t.ownerId !== player.id) continue;
    const space = spaceAt(Number(idx));
    total += t.mortgaged ? mortgageValue(space) : space.price;
    for (const building of t.buildings) {
      total += Math.round(buildingInvested(space, building) * RULES.sellRefund);
    }
  }
  for (const [idx, shares] of Object.entries(player.holdings ?? {})) {
    total += (shares / 1000) * (prices[Number(idx)] ?? 0);
  }
  return Math.max(0, Math.round(total));
}

export function loanCap(net: number): number {
  return Math.max(10_000, Math.floor((net * RULES.loanMaxMultiple) / 50) * 50);
}

export function loanInterest(principal: number): number {
  return Math.ceil(principal * RULES.loanInterest);
}

/** Fundamental value: list price scaled by rent yield and the best building's rank. */
export function fundamental(tile: number, tiles: Record<number, TileState>): number {
  const space = spaceAt(tile);
  if (space.price === 0) return 0;
  const state = tiles[tile];
  const yieldFactor = (space.rents[0] ?? 0) / space.price;
  const rank = state?.buildings.length ? Math.max(...state.buildings.map((b) => b.rank)) : 0;
  const group = state?.ownerId && ownsGroup(space.group, state.ownerId, tiles) ? 1 : 0;
  return space.price * RULES.stockStartMultiple * (1.1 + yieldFactor * 9 + rank * 0.22 + group * 0.18);
}

export function clampPrice(price: number, fund: number): number {
  return Math.min(fund * RULES.stockCeiling, Math.max(fund * RULES.stockFloor, price));
}

/** Next price for one tick. Deterministic given rng; volume is net shares bought. */
export function nextPrice(
  price: number,
  fund: number,
  netVolume: number,
  rng: () => number,
  dayOpen = price,
): number {
  const drift = ((fund - price) / Math.max(1, fund)) * RULES.stockDrift;
  const noise = (rng() * 2 - 1) * RULES.stockNoise;
  const impact = Math.max(-0.04, Math.min(0.04, netVolume / 1000));
  let next = price * (1 + drift + noise + impact);
  const tickChange = next / Math.max(1, price) - 1;
  next = price * (1 + Math.max(-RULES.stockTickCap, Math.min(RULES.stockTickCap, tickChange)));
  next = Math.min(dayOpen * (1 + RULES.stockDailyRiseCap), next);
  return clampPrice(next, fund);
}

export function dividendSplit(rent: number, shares: Record<string, number>): {
  owner: number;
  holders: Record<string, number>;
} {
  const totalExternal = Math.min(RULES.externalMax, Object.values(shares).reduce((a, b) => a + b, 0));
  const holders: Record<string, number> = {};
  if (totalExternal <= 0) return { owner: rent, holders };
  const scale = totalExternal / Object.values(shares).reduce((a, b) => a + b, 0);
  let paid = 0;
  for (const [id, share] of Object.entries(shares)) {
    const amount = Math.floor(rent * share * scale);
    holders[id] = amount;
    paid += amount;
  }
  return { owner: rent - paid, holders };
}

export function evadeChance(buildingsOnTile: number): number {
  return Math.max(0.05, RULES.evadeBase - RULES.evadePerBuilding * buildingsOnTile);
}

export function playerTheftChance(): number {
  return RULES.playerTheftBase;
}

/** Clamp to the allowed heist, then interpolate 20% down to 5%. */
export function robberyChance(amount: number): number {
  const clamped = Math.min(RULES.robberyMax, Math.max(RULES.robberyMin, amount));
  const t = (clamped - RULES.robberyMin) / (RULES.robberyMax - RULES.robberyMin);
  return RULES.robberyMinChance + t * (RULES.robberyMaxChance - RULES.robberyMinChance);
}

export function robberyAmountIssues(amount: number): string | null {
  if (!Number.isFinite(amount) || amount < RULES.robberyMin || amount > RULES.robberyMax) {
    return `Choose between ${RULES.robberyMin.toLocaleString('en-US')} and ${RULES.robberyMax.toLocaleString('en-US')}.`;
  }
  return null;
}

export function evidenceStrength(unpaidRent: number, findings: number): number {
  return Math.min(RULES.evidenceCap, Math.floor(unpaidRent / 100) + findings * RULES.evidencePerFinding);
}

export function maxClaim(strength: number): number {
  return Math.max(100, strength * 500);
}

export function suitChance(strength: number): number {
  return Math.min(RULES.suitChanceCap, RULES.suitBaseChance + RULES.suitPerStrength * strength);
}

export function applyReputation(reputation: number, delta: number): number {
  return Math.max(0, Math.min(100, reputation + delta));
}

export interface Card {
  id: string;
  deck: 'chance' | 'chest';
  text: string;
  effect:
    | { kind: 'cash'; amount: number }
    | { kind: 'move'; to: number; collectGo: boolean }
    | { kind: 'jail' }
    | { kind: 'jailFree' }
    | { kind: 'advanceNearestRail'; doubleRent: boolean }
    | { kind: 'repair'; perBuilding: number };
}

export const CARDS: Card[] = [
  { id: 'ch1', deck: 'chance', text: 'Advance to GO. Collect $200.', effect: { kind: 'move', to: 0, collectGo: true } },
  { id: 'ch2', deck: 'chance', text: 'Bank pays you a dividend of $50.', effect: { kind: 'cash', amount: 50 } },
  { id: 'ch3', deck: 'chance', text: 'Go directly to Jail. Do not pass GO.', effect: { kind: 'jail' } },
  { id: 'ch4', deck: 'chance', text: 'Your building loan matures. Collect $150.', effect: { kind: 'cash', amount: 150 } },
  { id: 'ch5', deck: 'chance', text: 'Advance to Boardwalk.', effect: { kind: 'move', to: 39, collectGo: false } },
  { id: 'ch6', deck: 'chance', text: 'Take a trip to Reading Railroad.', effect: { kind: 'move', to: 5, collectGo: false } },
  { id: 'ch7', deck: 'chance', text: 'The bank pays you $25 for services rendered.', effect: { kind: 'cash', amount: 25 } },
  { id: 'ch8', deck: 'chance', text: 'Speeding fine. Pay $15.', effect: { kind: 'cash', amount: -15 } },
  { id: 'ch9', deck: 'chance', text: 'You have won a crossword competition. Collect $100.', effect: { kind: 'cash', amount: 100 } },
  { id: 'ch10', deck: 'chance', text: 'Advance to the nearest railroad and pay double rent.', effect: { kind: 'advanceNearestRail', doubleRent: true } },
  { id: 'ch11', deck: 'chance', text: 'Make general repairs: $25 per building.', effect: { kind: 'repair', perBuilding: 25 } },
  { id: 'ch12', deck: 'chance', text: 'Get out of Jail free. Keep this card.', effect: { kind: 'jailFree' } },
  { id: 'cc1', deck: 'chest', text: 'Advance to GO. Collect $200.', effect: { kind: 'move', to: 0, collectGo: true } },
  { id: 'cc2', deck: 'chest', text: 'Bank error in your favour. Collect $200.', effect: { kind: 'cash', amount: 200 } },
  { id: 'cc3', deck: 'chest', text: "Doctor's fee. Pay $50.", effect: { kind: 'cash', amount: -50 } },
  { id: 'cc4', deck: 'chest', text: 'From sale of stock you get $50.', effect: { kind: 'cash', amount: 50 } },
  { id: 'cc5', deck: 'chest', text: 'Go directly to Jail. Do not pass GO.', effect: { kind: 'jail' } },
  { id: 'cc6', deck: 'chest', text: 'Holiday fund matures. Receive $100.', effect: { kind: 'cash', amount: 100 } },
  { id: 'cc7', deck: 'chest', text: 'Income tax refund. Collect $20.', effect: { kind: 'cash', amount: 20 } },
  { id: 'cc8', deck: 'chest', text: 'Life insurance matures. Collect $100.', effect: { kind: 'cash', amount: 100 } },
  { id: 'cc9', deck: 'chest', text: 'Pay hospital fees of $100.', effect: { kind: 'cash', amount: -100 } },
  { id: 'cc10', deck: 'chest', text: 'Receive $25 consultancy fee.', effect: { kind: 'cash', amount: 25 } },
  { id: 'cc11', deck: 'chest', text: 'You inherit $100.', effect: { kind: 'cash', amount: 100 } },
  { id: 'cc12', deck: 'chest', text: 'Get out of Jail free. Keep this card.', effect: { kind: 'jailFree' } },
];
