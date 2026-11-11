import { BUILDING_META, duplicateFactor } from './buildings';
import type { BuildingType, TileState } from './types';

/** Aggregated, server-computed perks for one owner. */
export interface PerkTotals {
  rentBoost: number;
  loanInterest: number;
  loanLimit: number;
  catchReduction: number;
  recovery: number;
  courtFee: number;
  courtOdds: number;
  stockFee: number;
  detectiveCost: number;
  detectiveOdds: number;
  jailFee: number;
  jailTime: number;
  insurance: number;
  casino: number;
  taxReduction: number;
  fireProtection: number;
  incomePerTurn: number;
  transport: number;
  reputationPerTurn: number;
  traffic: number;
  cashShield: number;
  theftBonus: number;
  spendingDiscount: number;
  seasonal: number;
}

export const EMPTY_PERKS: PerkTotals = {
  rentBoost: 0,
  loanInterest: 0,
  loanLimit: 0,
  catchReduction: 0,
  recovery: 0,
  courtFee: 0,
  courtOdds: 0,
  stockFee: 0,
  detectiveCost: 0,
  detectiveOdds: 0,
  jailFee: 0,
  jailTime: 0,
  insurance: 0,
  casino: 0,
  taxReduction: 0,
  fireProtection: 0,
  incomePerTurn: 0,
  transport: 0,
  reputationPerTurn: 0,
  traffic: 0,
  cashShield: 0,
  theftBonus: 0,
  spendingDiscount: 0,
  seasonal: 0,
};

export function perksForOwner(ownerId: string | null, tiles: Record<number, TileState>): PerkTotals {
  const out: PerkTotals = { ...EMPTY_PERKS };
  if (!ownerId) return out;
  let transports = 0;
  for (const tile of Object.values(tiles)) {
    if (tile.ownerId !== ownerId) continue;
    for (const [index, building] of tile.buildings.entries()) {
      const meta = BUILDING_META[building.type as BuildingType];
      if (!meta) continue;
      const amount = meta.perkValue * building.rank * duplicateFactor(tile.buildings, index);
      switch (meta.perkKey) {
        case 'steadyIncome': out.incomePerTurn += amount * 40; break;
        case 'loanDesk': out.loanInterest += amount; out.loanLimit += amount; break;
        case 'lawAndOrder': out.catchReduction += amount; break;
        case 'healRecovery': out.recovery += amount; out.jailTime += amount; break;
        case 'rentBoost': out.rentBoost += amount; break;
        case 'courtDesk': out.courtFee += amount; out.courtOdds += amount; break;
        case 'marketDesk': out.stockFee += amount; break;
        case 'detectiveDesk': out.detectiveCost += amount; out.detectiveOdds += amount; break;
        case 'jailDesk': out.jailTime += amount; out.jailFee += amount; break;
        case 'insurance': out.insurance += amount; break;
        case 'casino': out.casino += amount; break;
        case 'taxDesk': out.taxReduction += amount; break;
        case 'fireWatch': out.fireProtection += amount; break;
        case 'schooling': out.incomePerTurn += amount * 60; break;
        case 'powerGrid': out.transport += amount; break;
        case 'transport': out.transport += amount; transports += 1; break;
        case 'reputation': out.reputationPerTurn += amount; break;
        case 'traffic': out.traffic += amount; break;
        case 'cashShield': out.cashShield += amount; break;
        case 'underworld': out.theftBonus += amount; break;
        case 'hospitality': out.spendingDiscount += amount; break;
        case 'seasonal': out.seasonal += amount; out.traffic += amount; break;
        case 'security': out.catchReduction += amount; break;
        default: break;
      }
    }
  }
  if (transports > 1) out.transport += (transports - 1) * 0.01;
  return out;
}

/** Amount actually stolen after the victim's recovery/cash-shield perks. */
export function protectedTheftAmount(amount: number, victimPerks: PerkTotals): number {
  const keep = Math.min(0.6, victimPerks.cashShield + victimPerks.recovery * 0.5);
  return Math.max(0, Math.round(amount * (1 - keep)));
}
