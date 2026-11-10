/**
 * One source of truth for every tunable number in the client and the renderer.
 * Game-economy constants live in `src/game/rules.ts`; this file is visuals,
 * camera, timing and UI.
 */

export const PALETTE = {
  board: '#F3E4C4',
  boardFrame: '#3E2A1E',
  felt: '#2E6B4F',
  gold: '#F2B93B',
  positive: '#3FB27F',
  negative: '#E05555',
  warn: '#F08A24',
  ink: '#2A2320',
  inkSoft: 'rgba(42,35,32,0.62)',
  cream: '#FFF6E4',
  white: '#FFFFFF',
  groups: {
    brown: '#8A5A3B',
    lightblue: '#8FD3F4',
    pink: '#E85C9E',
    orange: '#F79A3E',
    red: '#E23B3B',
    yellow: '#F7D64A',
    green: '#37B36B',
    darkblue: '#2F6FD0',
    railroad: '#4A4A52',
    utility: '#6C7A89',
    corner: '#C9B79A',
  },
} as const;

export type GroupKey = keyof typeof PALETTE.groups;

export const CAMERA = {
  fov: 46,
  near: 0.06,
  far: 400,
  yaw: Math.PI / 4,
  pitch: 46 * (Math.PI / 180),
  /** Default framing keeps all four corners above the bottom dock. */
  radius: 22.5,
  /** Tight follow framing: the acting piece is large and centred. */
  followRadius: 8.8,
  /** Maximum horizontal pivot travel. Zoom never moves the pivot. */
  pivotRadius: 1.25,
  framingY: -2.2,
  minRadius: 7.2,
  maxRadius: 40,
  minPitch: 6 * (Math.PI / 180),
  maxPitch: 65 * (Math.PI / 180),
  damping: 0.9,
  snapDuration: 300,
  followResumeMs: 5000,
  followLerp: 2.6,
  clickLerp: 3.4,
  margin: 0.06,
} as const;

export const BOARD = {
  tile: 1.05,
  thickness: 0.22,
  frame: 0.62,
  /** 11 x 11 grid: 40 tiles around a 9 x 9 inner field. */
  size: 11,
  center: 9,
  gap: 0.012,
  /** Raised tile surface. Tokens, labels and buildings all use this height. */
  tileTop: 0.06,
} as const;

export const MODEL = {
  tokenMaxDimension: 0.42,
  buildingMaxDimension: 0.5,
  pedestalRadius: 0.15,
  idleBob: 0.02,
  idlePeriod: 2.4,
  hopHeight: 0.35,
  hopMs: 180,
  thumbnailSize: 192,
} as const;

export const RENDER = {
  maxPixelRatio: 2,
  shadowMapSize: 2048,
  bloomStrength: 0.2,
  bloomRadius: 0.45,
  bloomThreshold: 1.0,
  exposure: 0.9,
} as const;

export const MOTION = {
  sheetIn: 280,
  sheetOut: 210,
  fade: 140,
  countUp: 400,
  pop: 150,
  particle: 400,
} as const;

export const QUALITY = {
  low: { pixelRatio: 1, shadows: false, bloom: false, msaa: 0 },
  medium: { pixelRatio: 1.5, shadows: true, bloom: true, msaa: 2 },
  high: { pixelRatio: 2, shadows: true, bloom: true, msaa: 4 },
} as const;

export type QualityKey = keyof typeof QUALITY;

export const UI = {
  minScale: 0.8,
  maxScale: 1.3,
} as const;

/** Format money as `$1,234` — no decimals anywhere in the game. */
export function money(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}
