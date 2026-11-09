import { describe, expect, it } from 'vitest';
import { World } from '../server/world';
import type { GameEvent } from '../src/game/types';

function makeWorld(rngValues: number[] = [], mode: 'multi' | 'solo' = 'multi') {
  let clock = 100_000;
  const queue = [...rngValues];
  const events: GameEvent[] = [];
  const world = new World({
    mode,
    rng: () => (queue.length ? queue.shift()! : 0.42),
    now: () => clock,
    onEvent: (e) => events.push(e),
  });
  return {
    world,
    events,
    advance: (ms: number) => {
      clock += ms;
    },
    clock: () => clock,
  };
}

function botless(world: World) {
  for (const p of world.players.values()) p.isBot = false;
  return world;
}

describe('purchases', () => {
  it('gives a property to exactly one of two simultaneous buyers', () => {
    const { world } = makeWorld();
    const a = world.join('Ada', 'dog');
    const b = world.join('Bo', 'cat');
    botless(world);
    const space = 1;
    a.player.pending = { kind: 'buy', tile: space, amount: 60, expiresAt: 999_999 };
    b.player.pending = { kind: 'buy', tile: space, amount: 60, expiresAt: 999_999 };

    const first = world.intent(a.player.id, { t: 'buy', tile: space, key: 'a1' });
    const second = world.intent(b.player.id, { t: 'buy', tile: space, key: 'b1' });

    expect(first.ok).toBe(true);
    expect(second).toEqual({ ok: false, reason: 'already_owned' });
    expect(world.tiles[space]!.ownerId).toBe(a.player.id);
    expect(world.publicState().tiles[space]!.ownerId).toBe(a.player.id);
  });

  it('replays an idempotent intent without charging twice', () => {
    const { world } = makeWorld();
    const a = world.join('Ada', 'dog');
    botless(world);
    a.player.pending = { kind: 'buy', tile: 1, amount: 60, expiresAt: 999_999 };
    world.intent(a.player.id, { t: 'buy', tile: 1, key: 'same-key' });
    const afterFirst = a.player.cash;
    const replay = world.intent(a.player.id, { t: 'buy', tile: 1, key: 'same-key' });
    expect(replay.ok).toBe(true);
    expect(a.player.cash).toBe(afterFirst);
  });

  it('refuses a purchase the player cannot afford', () => {
    const { world } = makeWorld();
    const a = world.join('Ada', 'dog');
    botless(world);
    a.player.cash = 10;
    a.player.pending = { kind: 'buy', tile: 1, amount: 60, expiresAt: 999_999 };
    expect(world.intent(a.player.id, { t: 'buy', tile: 1, key: 'poor' })).toEqual({
      ok: false,
      reason: 'Not enough cash.',
    });
    expect(world.tiles[1]!.ownerId).toBeNull();
  });
});

describe('jail cascade', () => {
  it('sells buildings at half and mortgages every deed', () => {
    const { world } = makeWorld([0.99, 0.99]);
    const a = world.join('Ada', 'dog');
    botless(world);
    world.tiles[1]!.ownerId = a.player.id;
    world.tiles[1]!.building = 'house';
    world.tiles[3]!.ownerId = a.player.id;
    const cashBefore = a.player.cash;

    const result = world.intent(a.player.id, { t: 'robbery', amount: 50_000, key: 'heist' });
    expect(result.ok).toBe(true);
    expect(a.player.inJail).toBe(true);
    expect(a.player.position).toBe(10);
    expect(world.tiles[1]!.building).toBeNull();
    expect(world.tiles[1]!.mortgaged).toBe(true);
    expect(world.tiles[3]!.mortgaged).toBe(true);
    expect(a.player.jailOutcome).toBe('none');
    expect(a.player.cash).toBe(cashBefore + 25 + 30 + 30);
    expect(a.player.jailReleaseCost).toBe(33 + 33);
  });

  it('releases on payment and restores every deed', () => {
    const { world } = makeWorld();
    const a = world.join('Ada', 'dog');
    botless(world);
    world.tiles[1]!.ownerId = a.player.id;
    world.tiles[1]!.mortgaged = true;
    a.player.inJail = true;
    a.player.jailTurns = 2;
    a.player.jailReleaseCost = 33;
    a.player.cash = 500;
    const result = world.intent(a.player.id, { t: 'jailPay', key: 'bail' });
    expect(result.ok).toBe(true);
    expect(a.player.inJail).toBe(false);
    expect(world.tiles[1]!.mortgaged).toBe(false);
    expect(a.player.cash).toBe(467);
  });
});

describe('economy', () => {
  it('adds loan interest and deducts it on the next roll', () => {
    const { world, advance } = makeWorld();
    const a = world.join('Ada', 'dog');
    botless(world);
    expect(world.intent(a.player.id, { t: 'loan', amount: 200, key: 'l1' }).ok).toBe(true);
    expect(a.player.loan).toBe(200);
    expect(a.player.cash).toBe(1700);
    advance(1000);
    world.intent(a.player.id, { t: 'roll', key: 'r1' });
    expect(a.player.cash).toBeLessThan(1700);
  });

  it('caps external stock ownership at 50%', () => {
    const { world } = makeWorld();
    const owner = world.join('Owner', 'dog');
    const buyer = world.join('Buyer', 'cat');
    botless(world);
    world.tiles[1]!.ownerId = owner.player.id;
    buyer.player.cash = 100_000;
    expect(world.intent(buyer.player.id, { t: 'stock', tile: 1, qty: 500, key: 's1' }).ok).toBe(true);
    const tooMany = world.intent(buyer.player.id, { t: 'stock', tile: 1, qty: 1, key: 's2' });
    expect(tooMany).toEqual({ ok: false, reason: 'External ownership is capped at 50%.' });
  });

  it('pays dividends from rent to external holders', () => {
    const { world } = makeWorld();
    const owner = world.join('Owner', 'dog');
    const holder = world.join('Holder', 'cat');
    const renter = world.join('Renter', 'boat');
    botless(world);
    world.tiles[1]!.ownerId = owner.player.id;
    world.tiles[1]!.shares = { [holder.player.id]: 0.4 };
    renter.player.pending = { kind: 'rent', tile: 1, amount: 10, ownerId: owner.player.id, expiresAt: 999_999 };
    const ownerCash = owner.player.cash;
    const holderCash = holder.player.cash;
    world.intent(renter.player.id, { t: 'payRent', tile: 1, key: 'rent1' });
    expect(holder.player.cash).toBe(holderCash + 4);
    expect(owner.player.cash).toBe(ownerCash + 6);
  });

  it('auto-mortgages a property to cover loan interest', () => {
    const { world, advance } = makeWorld();
    const a = world.join('Ada', 'dog');
    botless(world);
    world.tiles[1]!.ownerId = a.player.id;
    a.player.loan = 1000;
    a.player.cash = 0;
    advance(1000);
    world.intent(a.player.id, { t: 'roll', key: 'r-interest' });
    expect(world.tiles[1]!.mortgaged).toBe(true);
    expect(a.player.bankrupt).toBe(false);
  });

  it('declares bankruptcy when nothing is left to mortgage', () => {
    const { world, advance } = makeWorld();
    const a = world.join('Ada', 'dog');
    botless(world);
    a.player.loan = 1000;
    a.player.cash = 0;
    advance(1000);
    world.intent(a.player.id, { t: 'roll', key: 'r-broke' });
    expect(a.player.bankrupt).toBe(true);
  });
});

describe('court', () => {
  it('needs evidence before a suit can be filed', () => {
    const { world } = makeWorld();
    const a = world.join('Ada', 'dog');
    const b = world.join('Bo', 'cat');
    botless(world);
    const noEvidence = world.intent(a.player.id, { t: 'sue', target: b.player.id, claim: 100, key: 'x' });
    expect(noEvidence.ok).toBe(false);
    expect(noEvidence.reason).toContain('evidence');
  });

  it('settles for 1.5x and unlocks deeds', () => {
    const { world } = makeWorld();
    const a = world.join('Ada', 'dog');
    const b = world.join('Bo', 'cat');
    botless(world);
    a.player.findings[b.player.id] = 1;
    b.player.unpaidRent = 100;
    world.tiles[1]!.ownerId = b.player.id;
    const filed = world.intent(a.player.id, { t: 'sue', target: b.player.id, claim: 400, key: 'suit' });
    expect(filed.ok).toBe(true);
    const suit = [...world.suits.values()][0]!;
    expect(world.tiles[1]!.lockedBy).toBe(suit.id);
    const settled = world.intent(b.player.id, { t: 'settle', suitId: suit.id, key: 'settle' });
    expect(settled.ok).toBe(true);
    expect(world.tiles[1]!.lockedBy).toBeNull();
    expect(suit.status).toBe('closed');
  });

  it('resolves court in submission order and closes the case', () => {
    const { world } = makeWorld([0.01]);
    const a = world.join('Ada', 'dog');
    const b = world.join('Bo', 'cat');
    botless(world);
    a.player.findings[b.player.id] = 2;
    b.player.unpaidRent = 500;
    world.intent(a.player.id, { t: 'sue', target: b.player.id, claim: 500, key: 'suit' });
    const suit = [...world.suits.values()][0]!;
    const cashBefore = a.player.cash;
    const result = world.intent(a.player.id, { t: 'court', suitId: suit.id, key: 'verdict' });
    expect(result.ok).toBe(true);
    expect(a.player.cash).toBeGreaterThan(cashBefore);
    expect(suit.status).toBe('closed');
    expect(world.tiles[1]!.lockedBy).toBeNull();
  });
});

describe('payload hygiene', () => {
  it('never broadcasts reputation, dossiers, loans or pending offers', () => {
    const { world } = makeWorld();
    const a = world.join('Ada', 'dog');
    botless(world);
    const payload = JSON.parse(JSON.stringify(world.publicState())) as unknown;
    const banned = new Set(['reputation', 'dossier', 'loan', 'holdings', 'unpaidRent', 'pending', 'session', 'intents', 'findings', 'prefs', 'jailFree']);
    const found: string[] = [];
    const walk = (value: unknown, trail: string): void => {
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        if (banned.has(key)) found.push(`${trail}.${key}`);
        walk(child, `${trail}.${key}`);
      }
    };
    walk(payload, 'state');
    expect(found).toEqual([]);
    expect(world.publicState().players[a.player.id]).not.toHaveProperty('reputation');
    expect(world.privateState(a.player.id).you.reputation).toBe(50);
  });
});

describe('concurrency ordering', () => {
  it('processes multiple visitors to one tile without stale balances', () => {
    const { world } = makeWorld();
    const owner = world.join('Owner', 'dog');
    const v1 = world.join('V1', 'cat');
    const v2 = world.join('V2', 'boat');
    botless(world);
    world.tiles[1]!.ownerId = owner.player.id;
    v1.player.pending = { kind: 'rent', tile: 1, amount: 2, ownerId: owner.player.id, expiresAt: 999_999 };
    v2.player.pending = { kind: 'rent', tile: 1, amount: 2, ownerId: owner.player.id, expiresAt: 999_999 };
    const ownerCash = owner.player.cash;
    world.intent(v1.player.id, { t: 'payRent', tile: 1, key: 'v1' });
    world.intent(v2.player.id, { t: 'payRent', tile: 1, key: 'v2' });
    expect(owner.player.cash).toBe(ownerCash + 4);
    expect(world.tiles[1]!.ownerId).toBe(owner.player.id);
  });
});

describe('solo table', () => {
  it('starts every seat at $1,500, keeps the human active and hands the turn over', () => {
    const { world } = makeWorld([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.1, 0.5], 'solo');
    const human = world.join('Ada', 'dog');
    world.addBot(['cat']);
    world.addBot(['boat']);
    world.addBot(['penguin']);
    const bots = [...world.players.values()].filter((p) => p.isBot);
    expect(bots).toHaveLength(3);
    for (const p of world.players.values()) expect(p.cash).toBe(1500);
    expect(world.publicState().activePlayerId).toBe(human.player.id);

    expect(world.intent(bots[0]!.id, { t: 'roll', key: 'too-early' })).toEqual({
      ok: false,
      reason: 'Wait for your turn.',
    });

    // 1 + 4 lands on Reading Railroad, which opens a purchase offer.
    expect(world.intent(human.player.id, { t: 'roll', key: 'r1' }).ok).toBe(true);
    expect(human.player.pending?.kind).toBe('buy');
    const price = human.player.pending?.amount ?? 0;
    expect(price).toBeGreaterThan(0);
    expect(world.intent(human.player.id, { t: 'buy', tile: human.player.pending!.tile, key: 'b1' }).ok).toBe(true);
    expect(human.player.cash).toBe(1500 - price);
    expect(world.publicState().activePlayerId).toBe(bots[0]!.id);
    expect(world.intent(human.player.id, { t: 'roll', key: 'not-yet' })).toEqual({
      ok: false,
      reason: 'Wait for your turn.',
    });
  });

  it('lets a hospitalized player roll to recover and pass the turn', () => {
    const { world } = makeWorld([], 'solo');
    const human = world.join('Ada', 'dog');
    world.addBot(['cat']);
    world.addBot(['boat']);
    human.player.inHospital = true;
    human.player.hospitalTurns = 2;

    expect(world.intent(human.player.id, { t: 'roll', key: 'recover' }).ok).toBe(true);
    expect(human.player.hospitalTurns).toBe(1);
    expect(human.player.inHospital).toBe(true);
    expect(world.publicState().activePlayerId).not.toBe(human.player.id);
  });
});

describe('chance meters', () => {
  it('returns the exact evasion odds and server roll with the event', () => {
    const { world, events } = makeWorld([0.99]);
    const actor = world.join('Ada', 'dog');
    const owner = world.join('Bo', 'cat');
    botless(world);
    actor.player.cash = 2000;
    actor.player.pending = { kind: 'rent', tile: 1, amount: 100, ownerId: owner.player.id, expiresAt: 999_999 };

    expect(world.intent(actor.player.id, { t: 'evade', tile: 1, key: 'evade' }).ok).toBe(true);
    const event = events.find((e) => e.chance)!;
    expect(event.chance!.percent).toBe(60);
    expect(event.chance!.rollPercent).toBe(99);
    expect(event.chance!.success).toBe(false);
    expect(actor.player.cash).toBe(1880);
  });

  it('returns bank robbery odds and a server roll at the chosen amount', () => {
    const { world, events } = makeWorld([0.1, 0.4]);
    const actor = world.join('Ada', 'dog');
    botless(world);
    expect(world.intent(actor.player.id, { t: 'robbery', amount: 50_000, key: 'heist' }).ok).toBe(true);
    const theft = events.find((e) => e.kind === 'theft')!;
    expect(theft.chance!.percent).toBe(20);
    expect(theft.chance!.rollPercent).toBe(10);
    expect(theft.chance!.success).toBe(true);
    expect(actor.player.cash).toBe(51_500);
  });

  it('returns the three jail sale zones and lands on the server outcome', () => {
    const { world, events } = makeWorld([0.9, 0.1]);
    const actor = world.join('Ada', 'dog');
    botless(world);
    world.tiles[1]!.ownerId = actor.player.id;
    world.tiles[1]!.building = 'house';

    expect(world.intent(actor.player.id, { t: 'robbery', amount: 50_000, key: 'caught' }).ok).toBe(true);
    const jail = events.find((e) => e.kind === 'jail')!;
    expect(jail.chance!.percent).toBe(100);
    expect(jail.chance!.rollPercent).toBe(10);
    expect(jail.chance!.zones?.map((z) => z.percent)).toEqual([25, 40, 35]);
    expect(jail.chance!.result).toBe('All properties sold');
    expect(world.tiles[1]!.ownerId).toBeNull();
    expect(actor.player.inJail).toBe(true);
  });

  it('uses a 5% murder roll and applies the hospital consequences', () => {
    const { world, events } = makeWorld([0.005]);
    const actor = world.join('Ada', 'dog');
    const victim = world.join('Bo', 'cat');
    botless(world);
    world.tiles[1]!.ownerId = victim.player.id;
    world.tiles[1]!.building = 'house';

    expect(world.intent(actor.player.id, { t: 'murder', target: victim.player.id, key: 'hit' }).ok).toBe(true);
    const murder = events.find((e) => e.kind === 'murder')!;
    expect(murder.chance!.percent).toBe(5);
    expect(murder.chance!.rollPercent).toBe(0.5);
    expect(murder.chance!.success).toBe(true);
    expect(murder.audience).toEqual([actor.player.id, victim.player.id]);
    expect(victim.player.inHospital).toBe(true);
    expect(victim.player.hospitalTurns).toBe(3);
    expect(victim.player.cash).toBe(0);
    expect(world.tiles[1]!.ownerId).toBeNull();
    expect(actor.player.reputation).toBe(0);
  });

  it('can sell some deeds on the jail meter', () => {
    const { world, events } = makeWorld([0.9, 0.5]);
    const actor = world.join('Ada', 'dog');
    botless(world);
    world.tiles[1]!.ownerId = actor.player.id;
    world.tiles[3]!.ownerId = actor.player.id;

    world.intent(actor.player.id, { t: 'robbery', amount: 50_000, key: 'caught-some' });
    const jail = events.find((e) => e.kind === 'jail')!;
    expect(jail.chance!.rollPercent).toBe(50);
    expect(jail.chance!.result).toContain('Some sold');
    expect(actor.player.jailSold).toHaveLength(1);
    const sold = [world.tiles[1]!.ownerId, world.tiles[3]!.ownerId].filter((id) => id === null);
    const mortgaged = [world.tiles[1]!.mortgaged, world.tiles[3]!.mortgaged].filter(Boolean);
    expect(sold).toHaveLength(1);
    expect(mortgaged).toHaveLength(1);
  });

  it('charges exactly $10,000 for a detective and keeps the report private', () => {
    const { world, events } = makeWorld([0.3]);
    const actor = world.join('Ada', 'dog');
    const target = world.join('Bo', 'cat');
    botless(world);
    actor.player.cash = 12_000;

    expect(world.intent(actor.player.id, { t: 'hireDetective', target: target.player.id, key: 'detective' }).ok).toBe(true);
    expect(actor.player.cash).toBe(2000);
    const report = events.find((e) => e.kind === 'detective')!;
    expect(report.chance!.percent).toBe(60);
    expect(report.chance!.rollPercent).toBe(30);
    expect(report.chance!.success).toBe(true);
    expect(report.audience).toEqual([actor.player.id]);
    expect(actor.player.dossier[target.player.id]).toBeDefined();
  });
});

describe('stock cost basis', () => {
  it('tracks basis per share and refuses to oversell', () => {
    const { world } = makeWorld();
    const actor = world.join('Ada', 'dog');
    botless(world);
    actor.player.cash = 100_000;
    const price = world.publicState().prices[1]!;

    expect(world.intent(actor.player.id, { t: 'stock', tile: 1, qty: 100, key: 'buy-shares' }).ok).toBe(true);
    expect(actor.player.holdings['1']).toBe(100);
    expect(actor.player.costBasis['1']).toBeCloseTo(price * 100, 6);

    const oversell = world.intent(actor.player.id, { t: 'stock', tile: 1, qty: -101, key: 'oversell' });
    expect(oversell.ok).toBe(false);
    expect(actor.player.holdings['1']).toBe(100);

    expect(world.intent(actor.player.id, { t: 'stock', tile: 1, qty: -40, key: 'sell-some' }).ok).toBe(true);
    expect(actor.player.holdings['1']).toBe(60);
    expect(actor.player.costBasis['1']).toBeCloseTo(price * 60, 6);

    expect(world.intent(actor.player.id, { t: 'stock', tile: 1, qty: -60, key: 'sell-rest' }).ok).toBe(true);
    expect(actor.player.holdings['1']).toBeUndefined();
    expect(actor.player.costBasis['1']).toBeUndefined();
  });
});

describe('player trades', () => {
  it('locks both sides and swaps cash and deeds atomically, keeping a mortgage', () => {
    const { world } = makeWorld();
    const a = world.join('Ada', 'dog');
    const b = world.join('Bo', 'cat');
    botless(world);
    world.tiles[1]!.ownerId = b.player.id;
    world.tiles[1]!.mortgaged = true;
    world.tiles[3]!.ownerId = a.player.id;

    expect(
      world.intent(a.player.id, {
        t: 'tradeOffer',
        targetId: b.player.id,
        giveCash: 100,
        giveTiles: [3],
        wantCash: 50,
        wantTiles: [1],
        key: 'offer',
      }),
    ).toEqual({ ok: true });
    const trade = [...world.trades.values()][0]!;
    expect(trade.status).toBe('pending');
    expect(world.tiles[1]!.lockedBy).toBe(`trade:${trade.id}`);
    expect(world.tiles[3]!.lockedBy).toBe(`trade:${trade.id}`);
    expect(world.intent(a.player.id, { t: 'mortgage', tile: 3, key: 'locked' })).toEqual({
      ok: false,
      reason: 'This property is locked by a pending deal.',
    });

    expect(world.intent(b.player.id, { t: 'tradeAccept', tradeId: trade.id, key: 'accept' })).toEqual({ ok: true });
    expect(a.player.cash).toBe(1450);
    expect(b.player.cash).toBe(1550);
    expect(world.tiles[1]!.ownerId).toBe(a.player.id);
    expect(world.tiles[3]!.ownerId).toBe(b.player.id);
    expect(world.tiles[1]!.mortgaged).toBe(true);
    expect(world.tiles[1]!.lockedBy).toBeNull();
    expect(world.tiles[3]!.lockedBy).toBeNull();
  });

  it('releases locks when an offer is declined', () => {
    const { world } = makeWorld();
    const a = world.join('Ada', 'dog');
    const b = world.join('Bo', 'cat');
    botless(world);
    world.tiles[1]!.ownerId = b.player.id;
    world.intent(a.player.id, { t: 'tradeOffer', targetId: b.player.id, giveCash: 100, giveTiles: [], wantCash: 0, wantTiles: [1], key: 'offer' });
    const trade = [...world.trades.values()][0]!;
    expect(trade).toBeDefined();
    expect(world.intent(b.player.id, { t: 'tradeDecline', tradeId: trade.id, key: 'no' })).toEqual({ ok: true });
    expect(world.tiles[1]!.lockedBy).toBeNull();
    expect(trade.status).toBe('declined');
  });

  it('counter-offers, locks the new assets and accepts atomically', () => {
    const { world } = makeWorld();
    const a = world.join('Ada', 'dog');
    const b = world.join('Bo', 'cat');
    botless(world);
    world.tiles[1]!.ownerId = b.player.id;
    world.intent(a.player.id, { t: 'tradeOffer', targetId: b.player.id, giveCash: 100, giveTiles: [], wantCash: 0, wantTiles: [1], key: 'offer' });
    const original = [...world.trades.values()][0]!;
    expect(
      world.intent(b.player.id, {
        t: 'tradeCounter',
        tradeId: original.id,
        giveCash: 0,
        giveTiles: [1],
        wantCash: 250,
        wantTiles: [],
        key: 'counter',
      }),
    ).toEqual({ ok: true });
    const counter = [...world.trades.values()].find((t) => t.status === 'pending')!;
    expect(counter.fromId).toBe(b.player.id);
    expect(counter.toId).toBe(a.player.id);
    expect(world.tiles[1]!.lockedBy).toBe(`trade:${counter.id}`);
    expect(world.intent(a.player.id, { t: 'tradeAccept', tradeId: counter.id, key: 'accept-counter' })).toEqual({ ok: true });
    expect(world.tiles[1]!.ownerId).toBe(a.player.id);
    expect(a.player.cash).toBe(1250);
    expect(world.tiles[1]!.lockedBy).toBeNull();
  });

  it('cannot add a bot to multiplayer and purge removes legacy bot seats', () => {
    const multi = makeWorld();
    expect(() => multi.world.addBot(['cat'])).toThrow('Bots cannot join a multiplayer board.');

    const solo = makeWorld([], 'solo');
    solo.world.join('Human', 'dog');
    const bot = solo.world.addBot(['cat']);
    solo.world.tiles[1]!.ownerId = bot.id;
    solo.world.purgeBots();
    expect(solo.world.players.has(bot.id)).toBe(false);
    expect(solo.world.tiles[1]!.ownerId).toBeNull();
  });
});
