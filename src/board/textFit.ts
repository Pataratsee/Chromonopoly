import opentype from 'opentype.js';
import type { Font } from 'opentype.js';
import { assetUrl } from '../assetUrl';

let font: Font | null = null;
let fontPromise: Promise<Font> | null = null;

export const FONT_URL = assetUrl('fonts/Inter-Medium.ttf');

export function loadFont(url = FONT_URL): Promise<Font> {
  if (font) return Promise.resolve(font);
  fontPromise ??= fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`font ${url} failed: ${r.status}`);
      return r.arrayBuffer();
    })
    .then((buf) => {
      font = opentype.parse(buf);
      return font;
    });
  return fontPromise;
}

export function measure(f: Font, text: string, size: number): number {
  return f.getAdvanceWidth(text, size, { kerning: true });
}

export interface FitResult {
  /** Font size in tile-local units (1 = one tile). */
  size: number;
  lines: string[];
  width: number;
  height: number;
}

const MIN_SIZE = 0.028;
const MAX_SIZE = 0.26;
const STEP = 0.0005;

/**
 * The brief's fitting algorithm, measured with real glyph metrics:
 * binary search the size, wrap to at most two lines at word boundaries,
 * shrink a single unbreakable word instead of splitting it, and never let
 * the resulting box exceed the content box.
 */
export function fitText(f: Font, text: string, box: { w: number; h: number }, maxSize = MAX_SIZE): FitResult {
  const words = text.split(/\s+/).filter(Boolean);
  const measureLines = (candidate: string[], size: number) => ({
    width: Math.max(...candidate.map((l) => measure(f, l, size))),
    height: candidate.length * size * 1.06,
  });

  const fits = (lines: string[], size: number) => {
    const m = measureLines(lines, size);
    if (m.width <= box.w && m.height <= box.h) return true;
    // A single long word may scale down, but never break.
    if (lines.length === 1) return m.width <= box.w && m.height <= box.h;
    return false;
  };

  const candidates: string[][] = [];
  if (words.length === 1) candidates.push([words[0]!]);
  else {
    // Prefer the most balanced 2-line split that fits.
    for (let i = 1; i < words.length; i += 1) {
      candidates.push([words.slice(0, i).join(' '), words.slice(i).join(' ')]);
    }
  }

  let best: FitResult | null = null;
  for (const lines of candidates) {
    let lo = MIN_SIZE;
    let hi = maxSize;
    let found: FitResult | null = null;
    for (let n = 0; n < 40 && hi - lo > STEP; n += 1) {
      const mid = (lo + hi) / 2;
      if (fits(lines, mid)) {
        const m = measureLines(lines, mid);
        found = { size: mid, lines, width: m.width, height: m.height };
        lo = mid;
      } else hi = mid;
    }
    if (found && (!best || found.size > best.size)) best = found;
  }

  if (best) return best;

  // Nothing fits: scale the smallest candidate down uniformly (never clip).
  const lines = candidates[0] ?? [text];
  let lo = 0.012;
  let hi = MIN_SIZE;
  for (let n = 0; n < 40 && hi - lo > STEP; n += 1) {
    const mid = (lo + hi) / 2;
    if (fits(lines, mid)) lo = mid;
    else hi = mid;
  }
  const m = measureLines(lines, lo);
  return { size: lo, lines, width: m.width, height: m.height };
}
