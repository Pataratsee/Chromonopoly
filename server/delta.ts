/**
 * JSON state deltas for the live board.
 *
 * Objects are diffed recursively; arrays are replaced as a unit because the
 * board's arrays are short and ordered. A key removed in the new state cannot be
 * represented by JSON Merge Patch (null is a real value in PublicState), so that
 * node is sent as `{ __replace: <new value> }`. The root is always an object.
 */
export type StatePatch = Record<string, unknown>;

const NO_CHANGE = Symbol('no-change');

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function diffValue(before: unknown, after: unknown): unknown | typeof NO_CHANGE {
  if (Object.is(before, after)) return NO_CHANGE;
  if (Array.isArray(after) || Array.isArray(before)) return after;
  if (isPlainObject(before) && isPlainObject(after)) {
    let removed = false;
    const out: StatePatch = {};
    for (const key of Object.keys(after)) {
      const child = diffValue(before[key], after[key]);
      if (child !== NO_CHANGE) out[key] = child;
    }
    for (const key of Object.keys(before)) {
      if (!(key in after)) {
        removed = true;
        break;
      }
    }
    if (removed) return { __replace: after };
    return Object.keys(out).length ? out : NO_CHANGE;
  }
  return after;
}

/** Returns null when the two states are identical. */
export function diffState(before: unknown, after: unknown): StatePatch | null {
  const patch = diffValue(before, after);
  if (patch === NO_CHANGE) return null;
  if (!isPlainObject(patch)) return { __replace: after };
  return patch;
}

/**
 * Applies a patch without mutating the previous state. The caller can keep the
 * old state for the next diff and pass the result straight to the renderer.
 */
export function applyStatePatch<T>(before: T, patch: StatePatch): T {
  if (Object.prototype.hasOwnProperty.call(patch, '__replace')) return patch.__replace as T;
  if (!isPlainObject(before)) return patch as T;
  const next: Record<string, unknown> = { ...before };
  for (const [key, value] of Object.entries(patch)) {
    if (isPlainObject(value) && isPlainObject(next[key])) {
      next[key] = applyStatePatch(next[key], value);
    } else if (Array.isArray(value)) {
      next[key] = value.slice();
    } else {
      next[key] = value;
    }
  }
  return next as T;
}
