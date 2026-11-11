import { describe, expect, it } from 'vitest';
import { applyStatePatch, diffState } from '../server/delta';

describe('live state deltas', () => {
  it('sends only changed branches and applies them immutably', () => {
    const before = {
      seq: 4,
      players: { a: { cash: 100, name: 'Ada' }, b: { cash: 200, name: 'Bo' } },
      tiles: { 1: { ownerId: null, buildings: [] } },
      log: [{ id: 1, text: 'one' }],
    };
    const after = {
      seq: 5,
      players: { a: { cash: 150, name: 'Ada' }, b: { cash: 200, name: 'Bo' } },
      tiles: { 1: { ownerId: null, buildings: [] } },
      log: [{ id: 1, text: 'one' }, { id: 2, text: 'two' }],
    };
    const patch = diffState(before, after)!;
    expect(JSON.stringify(patch)).not.toContain('Bo');
    expect(JSON.stringify(patch).length).toBeLessThan(JSON.stringify(after).length);
    const applied = applyStatePatch(before, patch);
    expect(applied).toEqual(after);
    expect(before.players.a.cash).toBe(100);
  });

  it('replaces array values and preserves nulls that are real state', () => {
    const before = { seq: 1, activePlayerId: 'a' as string | null, log: [1, 2], players: { a: { cash: 1 } } };
    const after = { seq: 2, activePlayerId: null, log: [1, 2, 3], players: { a: { cash: 1 } } };
    const applied = applyStatePatch(before, diffState(before, after)!);
    expect(applied).toEqual(after);
    expect(applied.activePlayerId).toBeNull();
  });

  it('falls back to a full replacement when a key is removed', () => {
    const before = { seq: 1, players: { a: { cash: 1 }, b: { cash: 2 } } };
    const after = { seq: 2, players: { a: { cash: 1 } } };
    const patch = diffState(before, after)!;
    expect(applyStatePatch(before, patch)).toEqual(after);
    expect(patch.players).toEqual({ __replace: { a: { cash: 1 } } });
  });

  it('reports no change for identical state', () => {
    const state = { seq: 8, players: {}, tiles: { 1: { ownerId: null } } };
    expect(diffState(state, structuredClone(state))).toBeNull();
  });
});
