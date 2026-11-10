import { RULES } from './rules';

/** One 30-second server candle. `t` is the bucket start in epoch ms. */
export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

export const CANDLE_MS = 30_000;
export const CANDLE_HISTORY = 520;

export function candleFor(t: number, price: number): Candle {
  const p = Math.max(0.01, price);
  return { t: Math.floor(t / CANDLE_MS) * CANDLE_MS, o: p, h: p, l: p, c: p };
}

/** Fold a price tick into the current candle, rolling over at the boundary. */
export function foldCandle(current: Candle | undefined, at: number, price: number): { candle: Candle; closed: Candle | null } {
  const bucket = Math.floor(at / CANDLE_MS) * CANDLE_MS;
  const p = Math.max(0.01, price);
  if (!current) return { candle: candleFor(bucket, p), closed: null };
  if (current.t === bucket) {
    return {
      candle: { ...current, h: Math.max(current.h, p), l: Math.min(current.l, p), c: p },
      closed: null,
    };
  }
  const next = candleFor(bucket, p);
  if (bucket < current.t) return { candle: current, closed: null };
  return { candle: next, closed: current };
}

/** Large prices move faster and further; cheap prices stay quiet. */
export function volatilityForPrice(price: number): number {
  return Math.min(0.055, 0.012 + Math.max(0, price) / 55_000);
}

/** Expensive tickers print more often, but the server still owns every quote. */
export function tickMsForPrice(price: number): number {
  if (price >= 1200) return 1400;
  if (price >= 400) return 2200;
  if (price >= 120) return 3200;
  return 4400;
}

/**
 * 520 closed candles (four hours twenty minutes) plus the current bucket, generated
 * from one server RNG so every client receives the same history.
 */
export function seedCandles(price: number, now: number, rng: () => number = () => 0.5): Candle[] {
  const end = Math.floor(now / CANDLE_MS) * CANDLE_MS;
  const raw: Candle[] = [];
  let close = Math.max(0.01, price);
  for (let i = 0; i < CANDLE_HISTORY; i += 1) {
    const t = end - (CANDLE_HISTORY - 1 - i) * CANDLE_MS;
    const vol = volatilityForPrice(close);
    const open = close / (1 + (rng() - 0.5) * vol);
    const nextClose = open * (1 + (rng() - 0.5) * vol * 1.4);
    const h = Math.max(open, nextClose) * (1 + rng() * vol * 0.35);
    const l = Math.max(0.01, Math.min(open, nextClose) * (1 - rng() * vol * 0.35));
    raw.push({ t, o: open, h, l, c: nextClose });
    close = nextClose;
  }
  // Anchor the visible history to the authoritative current price.
  const scale = Math.max(0.01, price) / Math.max(0.01, raw[raw.length - 1]!.c);
  return raw.map((c) => ({
    t: c.t,
    o: c.o * scale,
    h: c.h * scale,
    l: c.l * scale,
    c: c.c * scale,
  }));
}

/** Map a candle to the compact price path used by the client. */
export function candlePoints(candles: Candle[]): number[] {
  return candles.map((c) => c.c);
}

/**
 * Largest whole share count whose gross plus the server's rounded fee fits in
 * `cash`. This mirrors the server's `cost = gross + max(1, round(gross * fee))`.
 */
export function maxBuyShares(cash: number, price: number, fee = RULES.stockFee): number {
  const exec = Math.max(0.01, price) * (1 + RULES.stockSpread);
  let qty = Math.max(0, Math.floor(Math.max(0, cash) / exec));
  while (qty > 0) {
    const gross = qty * exec;
    const total = gross + Math.max(1, Math.round(gross * fee));
    if (total <= cash + 1e-6) return qty;
    qty -= 1;
  }
  return 0;
}

export function tradeCost(qty: number, price: number, fee = RULES.stockFee): number {
  const gross = qty * Math.max(0.01, price) * (1 + RULES.stockSpread);
  return gross + Math.max(1, Math.round(gross * fee));
}
