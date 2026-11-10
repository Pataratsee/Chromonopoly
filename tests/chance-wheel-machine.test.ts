import { describe, expect, it } from 'vitest';
import { WheelStateMachine } from '../src/ui/chanceWheel';

describe('W5 wheel lifecycle', () => {
  it('records timestamped IDLE → READY → SPINNING → LANDED → RESULT_SHOWN → CLOSED', () => {
    let now = 1000;
    const wheel = new WheelStateMachine(() => now);
    for (const state of ['READY', 'SPINNING', 'LANDED', 'RESULT_SHOWN', 'CLOSED'] as const) {
      now += 100;
      wheel.transition(state);
    }
    expect(wheel.transitions.map((entry) => entry.state)).toEqual([
      'IDLE', 'READY', 'SPINNING', 'LANDED', 'RESULT_SHOWN', 'CLOSED',
    ]);
    for (let i = 1; i < wheel.transitions.length; i += 1) {
      expect(wheel.transitions[i]!.at).toBeGreaterThan(wheel.transitions[i - 1]!.at);
    }
    expect(wheel.snapshot()).toEqual({ state: 'CLOSED', at: 1500 });
  });

  it('ignores duplicate transitions instead of faking a second landing', () => {
    const wheel = new WheelStateMachine(() => 1);
    wheel.transition('READY');
    wheel.transition('LANDED');
    wheel.transition('LANDED');
    expect(wheel.transitions.filter((entry) => entry.state === 'LANDED')).toHaveLength(1);
  });
});
