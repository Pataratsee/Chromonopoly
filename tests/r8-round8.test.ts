import { describe, expect, it } from 'vitest';
import { World } from '../server/world';
import { RULES } from '../src/game/rules';
import { wheelColor, wheelZones } from '../src/ui/chanceWheel';
import type { GameEvent } from '../src/game/types';

function makeWorld(rngValues: number[] = []) {
  let clock = 100_000;
  const queue = [...rngValues];
  const events: GameEvent[] = [];
  const world = new World({
    mode: 'multi',
    rng: () => (queue.length ? queue.shift()! : 0.42),
    now: () => clock,
    onEvent: (e) => events.push(e),
  });
  return { world, events, advance: (ms: number) => { clock += ms; }, clock: () => clock };
}

const botless = (world: World): void => {
  for (const p of world.players.values()) p.isBot = false;
};

describe('Round 8: jail dice always settle', () => {
  it('emits a roll result on every jail roll, including a non-freeing one', () => {
    // 0.9 fails the robbery (20% success), then jail rolls use the next values.
    const { world, events } = makeWorld([0.9, 0.5, 0.5]);
    const actor = world.join('Ada', 'dog');
    botless(world);
    world.intent(actor.player.id, { t: 'robbery', amount: 50_000, key: 'caught' });
    expect(actor.player.inJail).toBe(true);

    events.length = 0;
    expect(world.intent(actor.player.id, { t: 'roll', key: 'jail-1' }).ok).toBe(true);
    const roll = events.find((e) => e.kind === 'roll');
    expect(roll, 'the client needs a dice result').toBeTruthy();
    expect(roll!.dice).toHaveLength(2);
    expect(actor.player.inJail).toBe(true);
    expect(actor.player.jailTurns).toBe(RULES.jailTurns - 1);
  });

  it('releases on doubles and never leaves the roll without a result', () => {
    const { world, events } = makeWorld([0.9, 0.42, 0.42]);
    const actor = world.join('Ada', 'dog');
    botless(world);
    world.intent(actor.player.id, { t: 'robbery', amount: 50_000, key: 'caught' });

    events.length = 0;
    world.intent(actor.player.id, { t: 'roll', key: 'jail-doubles' });
    expect(events.some((e) => e.kind === 'roll')).toBe(true);
    expect(events.some((e) => e.kind === 'jail' && e.text === 'released')).toBe(true);
    expect(actor.player.inJail).toBe(false);
  });

  it('releases after the third failed roll', () => {
    const { world, events } = makeWorld([0.9, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
    const actor = world.join('Ada', 'dog');
    botless(world);
    world.intent(actor.player.id, { t: 'robbery', amount: 50_000, key: 'caught' });

    for (let i = 0; i < RULES.jailTurns + 1 && actor.player.inJail; i += 1) {
      events.length = 0;
      world.intent(actor.player.id, { t: 'roll', key: `jail-${i}` });
      expect(events.some((e) => e.kind === 'roll'), `roll ${i} must settle`).toBe(true);
    }
    expect(actor.player.inJail).toBe(false);
  });
});

describe('Round 8: reputation stays private', () => {
  it('never serialises reputation, dossiers or private acts into public state', () => {
    const { world } = makeWorld();
    const a = world.join('Ada', 'dog');
    const b = world.join('Bo', 'cat');
    a.player.reputation = 13;
    a.player.dossier[b.player.id] = { reputation: 66, evidence: 2, at: 1, record: [], acts: [] };
    b.player.reputation = 77;

    for (const player of Object.values(world.publicState().players)) {
      expect(player).not.toHaveProperty('reputation');
      expect(player).not.toHaveProperty('dossier');
      expect(player).not.toHaveProperty('acts');
    }
    expect(JSON.stringify(world.publicState())).not.toContain('dossier');

    const bPrivate = world.privateState(b.player.id);
    expect(bPrivate.you.reputation).toBe(77);
    expect(bPrivate.you.dossier[a.player.id]).toBeUndefined();
    expect(bPrivate.you.dossier[b.player.id]).toBeUndefined();
  });
});

describe('Round 8: jail-sale wheel colours', () => {
  it('colours none/some/all by outcome instead of three reds', () => {
    const zones = wheelZones(100, [
      { key: 'all', label: 'All sold', percent: 25 },
      { key: 'some', label: 'Some sold', percent: 40 },
      { key: 'none', label: 'None sold', percent: 35 },
    ]);
    const colours = zones.map(wheelColor);
    expect(new Set(colours).size).toBe(3);
    expect(wheelColor(zones[2]!, 2)).toBe('#2F9E6F');
    expect(wheelColor(zones[1]!, 1)).toBe('#D99A2B');
    expect(wheelColor(zones[0]!, 0)).toBe('#C94C45');
  });
});

describe('Round 8: murder is exactly 5%', () => {
  it('lands inside 4.6–5.4% over 10,000 attempts', () => {
    let seed = 123456789;
    const next = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    let wins = 0;
    const attempts = 10_000;
    for (let i = 0; i < attempts; i += 1) {
      if (next() * 100 < RULES.murderChance * 100) wins += 1;
    }
    expect(RULES.murderChance).toBe(0.05);
    expect(wins / attempts).toBeGreaterThan(0.046);
    expect(wins / attempts).toBeLessThan(0.054);
  });
});
