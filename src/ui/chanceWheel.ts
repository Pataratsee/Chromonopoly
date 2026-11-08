export interface WheelZone {
  key: string;
  label: string;
  percent: number;
  success: boolean;
}

export const SPIN_MS = 6800;
export const MIN_TURNS = 6;
export const MAX_TURNS = 10;

const clampPercent = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100 - 1e-6, Math.max(0, value));
};

/** Build real wheel segments; failure is split into alternating red arcs. */
export function wheelZones(percent: number, zones?: Array<{ key: string; label: string; percent: number }>): WheelZone[] {
  if (zones?.length) {
    return zones.map((z) => ({
      ...z,
      success: z.key === 'success' || /success/i.test(z.label),
    }));
  }
  const success = clampPercent(percent);
  const fail = 100 - success;
  return [
    { key: 'success', label: 'Success', percent: success, success: true },
    { key: 'fail', label: 'Failure', percent: fail, success: false },
  ];
}

export function zoneIsSuccess(zone: WheelZone): boolean {
  return zone.success;
}

/**
 * CSS conic gradients start at 12 o'clock and run clockwise. The pointer is
 * fixed at 12 o'clock, so move the requested percentage under it by rotating
 * the wheel backwards by that exact amount.
 */
export function rotationForPercent(percent: number): number {
  const p = clampPercent(percent);
  return (360 - p * 3.6) % 360;
}

/** Plan a 6.8 s, 6-10 turn spin ending exactly on the requested segment. */
export function spinPlan(currentRotation: number, percent: number): { from: number; delta: number; total: number; duration: number } {
  const from = ((currentRotation % 360) + 360) % 360;
  const target = rotationForPercent(percent);
  const to = ((target - from) % 360 + 360) % 360;
  const total = MIN_TURNS * 360 + to;
  const turns = total / 360;
  if (turns < MIN_TURNS || turns > MAX_TURNS) throw new Error(`spin turns out of range: ${turns}`);
  return { from, delta: to, total, duration: SPIN_MS };
}

export function rotationAt(plan: { from: number; total: number }, elapsed: number): number {
  const t = Math.min(1, Math.max(0, elapsed / SPIN_MS));
  const ease = 1 - Math.pow(1 - t, 5);
  return plan.from + plan.total * ease;
}

/** The segment under the fixed top pointer at a given wheel rotation. */
export function segmentAtRotation(rotation: number, zones: WheelZone[]): number {
  const total = zones.reduce((sum, z) => sum + z.percent, 0);
  if (total <= 0) return 0;
  const local = ((-rotation % 360) + 360) % 360;
  const percent = (local / 360) * total;
  let cursor = 0;
  for (let i = 0; i < zones.length; i += 1) {
    const zone = zones[i]!;
    cursor += zone.percent;
    if (percent < cursor || i === zones.length - 1) return i;
  }
  return zones.length - 1;
}

export function segmentsForDisplay(zones: WheelZone[]): Array<WheelZone & { start: number; end: number }> {
  let cursor = 0;
  return zones.map((zone) => {
    const start = cursor;
    cursor += zone.percent;
    return { ...zone, start, end: cursor };
  });
}
