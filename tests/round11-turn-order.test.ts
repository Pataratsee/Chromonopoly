import { describe, expect, it } from 'vitest';
import { World } from '../server/world';
import { RULES } from '../src/game/rules';

function seeded(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function soloGame(seed: number) {
  let clock = 100_000;
  const world = new World({ mode: 'solo', rng: seeded(seed), now: () => clock });
  const human = world.join('Human', 'dog');
  world.addBot(['cat']);
  world.addBot(['boat']);
  world.addBot(['penguin']);
  return { world, human, tick: (ms = 900) => { clock += ms; } };
}

describe('Y3 strict solo turn order', () => {
  it('keeps 200 seeded games on the human-to-bot seat ring and never lets a bot skip', () => {
    for (let game = 0; game < 200; game += 1) {
      const { world, human, tick } = soloGame(0x9e37 + game * 7919);
      const seats = [human.player.id, ...[...world.players.values()].filter((p) => p.isBot).map((p) => p.id)];
      let previous: string | null = null;
      let turns = 0;
      for (let step = 0; step < 80 && !world.publicState().gameOver; step += 1) {
        const state = world.publicState();
        const activeId = state.activePlayerId;
        expect(activeId, `game ${game}: no active player`).toBeTruthy();
        const active = world.players.get(activeId!);
        expect(active, `game ${game}: active player missing`).toBeTruthy();
        if (previous) {
          const alive = seats.filter((id) => !world.players.get(id)?.bankrupt);
          const from = alive.indexOf(previous);
          const next = alive[(from + 1) % alive.length];
          expect([previous, next], `game ${game}: ${previous} -> ${activeId}`).toContain(activeId);
        }
        previous = activeId!;
        const wrongSeat = seats.find((id) => id !== activeId && !world.players.get(id)?.bankrupt);
        if (wrongSeat) {
          expect(world.intent(wrongSeat, { t: 'roll', key: `skip-${game}-${step}` })).toEqual({
            ok: false,
            reason: 'Wait for your turn.',
          });
        }
        if (active!.pending?.kind === 'buy') {
          world.intent(activeId!, { t: 'buy', tile: active!.pending.tile, key: `buy-${game}-${step}` });
        } else if (active!.pending?.kind === 'rent') {
          world.intent(activeId!, { t: 'payRent', tile: active!.pending.tile, key: `rent-${game}-${step}` });
        } else if (active!.inJail && active!.cash >= RULES.jailFeeMin) {
          const paid = world.intent(activeId!, { t: 'jailPay', key: `jail-${game}-${step}` });
          if (!paid.ok) world.intent(activeId!, { t: 'roll', key: `jail-roll-${game}-${step}` });
        } else {
          const rolled = world.intent(activeId!, { t: 'roll', key: `roll-${game}-${step}` });
          expect(rolled.ok, `game ${game}: roll rejected: ${rolled.reason}`).toBe(true);
          if (active!.pending?.kind === 'buy') {
            world.intent(activeId!, { t: 'decline', tile: active!.pending.tile, key: `decline-${game}-${step}` });
          } else if (active!.pending?.kind === 'rent') {
            world.intent(activeId!, { t: 'payRent', tile: active!.pending.tile, key: `pay-${game}-${step}` });
          }
        }
        tick();
        turns += 1;
      }
      expect(turns, `game ${game}: simulation made no progress`).toBeGreaterThan(0);
    }
  });

  it('forces a stalled bot turn within the 20-second watchdog', () => {
    let clock = 100_000;
    const world = new World({ mode: 'solo', rng: seeded(11), now: () => clock });
    const human = world.join('Human', 'dog');
    const bot = world.addBot(['cat']);
    world.addBot(['boat']);
    world.addBot(['penguin']);
    // Hand the turn to the first bot without waiting for a whole board cycle.
    human.player.extraRoll = false;
    world.activePlayerId = bot.id;
    world['turnStartedAt'] = clock;
    bot.botNextActionAt = clock + 999_999;
    clock += 20_000;
    world.runBots();
    expect(bot.lastRollAt > 0 || bot.pending !== null, 'bot made no action after the watchdog').toBe(true);
    expect(world.publicState().activePlayerId).not.toBe(human.player.id);
  });
});
