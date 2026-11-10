import { SPACES } from '../src/game/board';
import { fundamental, nextPrice, RULES } from '../src/game/rules';
import type { TileState } from '../src/game/types';

const PLAYERS = Number(process.env.MARKET_PLAYERS ?? 10_000);
const TICKS = Number(process.env.MARKET_TICKS ?? 16);
const tunable = RULES as unknown as Record<string, number>;
for (const key of ['stockDrift', 'stockNoise', 'stockFee', 'stockSpread']) {
  const env = process.env[`MARKET_${key.replace('stock', '').toUpperCase()}`];
  if (env !== undefined) tunable[key] = Number(env);
}
const tiles: Record<number, TileState> = {};
for (const space of SPACES) tiles[space.index] = { ownerId: null, mortgaged: false, buildings: [], shares: {}, lockedBy: null };

const stocks = SPACES.filter((s) => s.price > 0).slice(0, 16);
const start = new Map(stocks.map((s) => [s.index, fundamental(s.index, tiles)]));

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const returns: number[] = [];
let profitable = 0;
let meaningful = 0;
let large = 0;
let total = 0;

for (let player = 0; player < PLAYERS; player += 1) {
  const rng = mulberry(player + 1);
  const prices = new Map(start);
  let cash = 10_000;
  const holdings = new Map<number, number>();

  for (let tick = 0; tick < TICKS; tick += 1) {
    const space = stocks[Math.floor(rng() * stocks.length)]!;
    const price = prices.get(space.index)!;
    const buy = rng() < 0.52;
    const wanted = 1 + Math.floor(rng() * 60);
    const execution = price * (buy ? 1 + RULES.stockSpread : 1 - RULES.stockSpread);
    const affordable = Math.floor(cash / (execution * (1 + RULES.stockFee)));
    const qty = buy ? Math.min(wanted, affordable) : wanted;
    const fee = Math.max(1, Math.round(qty * execution * RULES.stockFee));
    let netVolume = 0;
    if (buy) {
      const held = holdings.get(space.index) ?? 0;
      if (qty > 0 && held + qty <= 1000) {
        cash -= qty * execution + fee;
        holdings.set(space.index, held + qty);
        netVolume = qty;
      }
    } else {
      const held = holdings.get(space.index) ?? 0;
      const sell = Math.min(qty, held);
      if (sell > 0) {
        cash += sell * execution - fee;
        holdings.set(space.index, held - sell);
        netVolume = -sell;
      }
    }

    // One market tick per decision. Every ticker moves once; only the traded
    // ticker receives this player's order flow. The old simulation updated all
    // sixteen stocks on every action, creating 256 invalid moves per player.
    for (const stock of stocks) {
      const p = prices.get(stock.index)!;
      prices.set(
        stock.index,
        nextPrice(p, fundamental(stock.index, tiles), stock.index === space.index ? netVolume : 0, rng),
      );
    }
  }

  let value = cash;
  for (const [tile, qty] of holdings) {
    const price = prices.get(tile)!;
    value += qty * price * (1 - RULES.stockSpread) - Math.max(1, Math.round(qty * price * RULES.stockFee));
  }
  const ret = value / 10_000 - 1;
  returns.push(ret);
  total += ret;
  if (ret > 0) profitable += 1;
  if (ret > 0.05) meaningful += 1;
  if (ret > 0.25) large += 1;
}

returns.sort((a, b) => a - b);
const q = (f: number): number => returns[Math.min(returns.length - 1, Math.floor(f * returns.length))]!;
console.log(JSON.stringify({
  players: PLAYERS,
  ticks: TICKS,
  fee: RULES.stockFee,
  spread: RULES.stockSpread,
  drift: RULES.stockDrift,
  noise: RULES.stockNoise,
  mean: total / PLAYERS,
  median: q(0.5),
  p10: q(0.1),
  p90: q(0.9),
  p99: q(0.99),
  profitable: profitable / PLAYERS,
  meaningful: meaningful / PLAYERS,
  large: large / PLAYERS,
  max: returns[returns.length - 1],
  min: returns[0],
}, null, 2));
