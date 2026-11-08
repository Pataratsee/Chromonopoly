import { randomInt } from 'node:crypto';
import { SPACES, spaceAt, advanceTile, groupMembers } from '../src/game/board';
import {
  BUILDING_META,
  CARDS,
  RULES,
  applyReputation,
  buildingCost,
  canBuild,
  clampPrice,
  dividendSplit,
  emptyTile,
  evidenceStrength,
  evadeChance,
  fundamental,
  groupBuildingCount,
  loanCap,
  loanInterest,
  maxClaim,
  mortgageValue,
  netWorth,
  ownsGroup,
  playerTheftChance,
  rentFor,
  robberyAmountIssues,
  robberyChance,
  suitChance,
  unmortgageCost,
} from '../src/game/rules';
import type {
  BuildingType,
  ChanceRoll,
  GameEvent,
  GameMode,
  Intent,
  LogEntry,
  MarketFeedEntry,
  Pending,
  PlayerPrivate,
  PlayerPublic,
  PrivateState,
  PublicState,
  Suit,
  TileState,
  TradeOffer,
} from '../src/game/types';
import type { Card } from '../src/game/rules';

const TOKEN_COLORS = ['#E23B3B', '#2F6FD0', '#37B36B', '#F79A3E', '#8A5A3B', '#E85C9E', '#6C7A89', '#F7D64A'];
const BOT_NAMES = ['Ada Tycoon', 'Mr. Ledger', 'Penny Sharp', 'Count Deed', 'Vera Vault'];

interface ServerPlayer extends PlayerPrivate {
  session: string;
  loan: number;
  holdings: Record<string, number>;
  unpaidRent: number;
  consecutiveDoubles: number;
  pending: Pending | null;
  jailFree: number;
  lastRollAt: number;
  lastTheftAt: number;
  murderReadyAt: number;
  extraRoll: boolean;
  intents: Map<string, unknown>;
  findings: Record<string, number>;
  prefs: Record<string, unknown>;
}

export interface WorldSnapshot {
  seq: number;
  players: ServerPlayer[];
  tiles: Record<number, TileState>;
  prices: Record<number, number>;
  log: LogEntry[];
  suitSeq: number;
  logSeq: number;
  activePlayerId?: string | null;
  turnNumber?: number;
  trades?: TradeOffer[];
  marketFeed?: MarketFeedEntry[];
  marketSeq?: number;
}

export interface WorldOptions {
  rng?: () => number;
  now?: () => number;
  mode?: GameMode;
  onEvent?: (event: GameEvent) => void;
}

/** Loopback-only scenario hook used by Playwright; never reachable in production. */
export interface TestSetup {
  kind: 'cash' | 'rent' | 'jail' | 'evidence' | 'suit' | 'build' | 'endgame' | 'theft' | 'offer' | 'card';
  tile?: number;
  ownerSession?: string;
  targetSession?: string;
  building?: BuildingType;
  cash?: number;
  reputation?: number;
  findings?: number;
  unpaid?: number;
  claim?: number;
  roll?: number;
  deck?: 'chance' | 'chest';
}

let idCounter = 0;

function uid(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

export class World {
  readonly players = new Map<string, ServerPlayer>();
  tiles: Record<number, TileState> = {};
  prices: Record<number, number> = {};
  log: LogEntry[] = [];
  marketFeed: MarketFeedEntry[] = [];
  marketSeq = 0;
  suits = new Map<string, Suit>();
  trades = new Map<string, TradeOffer>();
  seq = 0;
  logSeq = 0;
  suitSeq = 0;
  buildingCount = 0;
  gameOver: null | { winnerId: string; at: number } = null;
  dirty = false;
  readonly mode: GameMode;
  activePlayerId: string | null = null;
  turnNumber = 0;
  private volumes: Record<number, number> = {};
  private lastBotAt = 0;
  private turnStartedAt = 0;
  private readonly baseRng: () => number;
  private rng: () => number;
  private testRoll: number | null = null;
  private readonly now: () => number;
  private readonly onEvent: (event: GameEvent) => void;
  private tickTimer = 0;
  private readonly botTradeAt = new Map<string, number>();

  constructor(opts: WorldOptions = {}) {
    this.mode = opts.mode ?? 'multi';
    this.baseRng = opts.rng ?? (() => randomInt(0, 1_000_000_000) / 1_000_000_000);
    this.rng = this.baseRng;
    this.now = opts.now ?? (() => Date.now());
    this.onEvent = opts.onEvent ?? (() => undefined);
    for (const s of SPACES) {
      this.tiles[s.index] = emptyTile();
      this.prices[s.index] = s.price ? s.price * RULES.stockStartMultiple : 0;
    }
  }

  // ---------------------------------------------------------------- players

  join(
    name: string,
    tokenId: string,
    session?: string,
    accountId?: string,
    requestedColor?: string,
  ): { player: ServerPlayer; session: string } {
    // A password account owns exactly one persistent seat. A second computer
    // with the same account arrives without the old session and still gets it.
    const existing = accountId
      ? this.players.get(accountId)
      : session
        ? [...this.players.values()].find((p) => p.session === session)
        : undefined;
    if (existing) {
      existing.lastSeen = this.now();
      if (accountId) existing.name = name.slice(0, 16) || existing.name;
      if (tokenId) existing.tokenId = tokenId;
      if (requestedColor && TOKEN_COLORS.includes(requestedColor)) existing.color = requestedColor;
      return { player: existing, session: existing.session };
    }
    const id = accountId ?? uid('p');
    const player: ServerPlayer = {
      id,
      name: accountId ? name.slice(0, 16) : name.slice(0, 24) || 'Tycoon',
      tokenId: tokenId || 'cat',
      color: requestedColor && TOKEN_COLORS.includes(requestedColor)
        ? requestedColor
        : TOKEN_COLORS[this.players.size % TOKEN_COLORS.length]!,
      cash: 1500,
      position: 0,
      inJail: false,
      jailTurns: 0,
      jailReleaseCost: 0,
      jailCause: null,
      jailOutcome: null,
      jailSold: [],
      inHospital: false,
      hospitalTurns: 0,
      bankrupt: false,
      jailRecord: [],
      lastSeen: this.now(),
      isBot: false,
      reputation: 50,
      dossier: {},
      acts: [],
      loan: 0,
      holdings: {},
      costBasis: {},
      realizedPnl: 0,
      unpaidRent: 0,
      consecutiveDoubles: 0,
      pending: null,
      jailFree: 0,
      lastRollAt: 0,
      lastTheftAt: 0,
      murderReadyAt: 0,
      extraRoll: false,
      intents: new Map(),
      findings: {},
      prefs: {},
      session: uid('s'),
    };
    this.players.set(id, player);
    if (this.mode === 'solo' && !this.activePlayerId) {
      this.activePlayerId = player.id;
      this.turnNumber = 1;
      this.turnStartedAt = this.now();
    }
    this.logLine(`${player.name} joins the board.`, 'info');
    this.dirty = true;
    return { player, session: player.session };
  }

  addBot(tokenIds: string[], difficulty = 0.7): ServerPlayer {
    if (this.mode !== 'solo') throw new Error('Bots cannot join a multiplayer board.');
    const name = BOT_NAMES[this.players.size % BOT_NAMES.length]!;
    const { player } = this.join(name, tokenIds[this.players.size % tokenIds.length] ?? 'cat');
    player.isBot = true;
    player.reputation = 40 + Math.floor(this.rng() * 30);
    player.lastRollAt = this.now() + 800 + this.rng() * difficulty * 1600;
    return player;
  }

  // ------------------------------------------------------------------ state

  publicState(): PublicState {
    const players: Record<string, PlayerPublic> = {};
    for (const p of this.players.values()) {
      players[p.id] = {
        id: p.id,
        name: p.name,
        tokenId: p.tokenId,
        color: p.color,
        cash: p.cash,
        position: p.position,
        inJail: p.inJail,
        jailTurns: p.jailTurns,
        jailReleaseCost: this.jailReleaseCost(p),
        jailCause: p.jailCause,
        jailOutcome: p.jailOutcome,
        jailSold: p.jailSold,
        inHospital: p.inHospital,
        hospitalTurns: p.hospitalTurns,
        bankrupt: p.bankrupt,
        jailRecord: p.jailRecord,
        lastSeen: p.lastSeen,
        isBot: p.isBot,
      };
    }
    return {
      seq: this.seq,
      serverTime: this.now(),
      mode: this.mode,
      activePlayerId: this.activePlayerId,
      turnNumber: this.turnNumber,
      players,
      tiles: this.tiles,
      prices: this.prices,
      log: this.log.slice(-60),
      playerLogs: Object.fromEntries(
        [...this.players.values()].map((p) => [
          p.id,
          this.log.filter((entry) => entry.text.includes(p.name)).slice(-80),
        ]),
      ),
      marketFeed: this.marketFeed.slice(-40),
      buildingCount: this.buildingCount,
      gameOver: this.gameOver,
    };
  }

  privateState(playerId: string): PrivateState {
    const p = this.players.get(playerId);
    if (!p) throw new Error('unknown player');
    const pub = this.publicState().players[playerId]!;
    const privatePlayer: PlayerPrivate = {
      ...pub,
      reputation: p.reputation,
      dossier: p.dossier,
      acts: p.acts,
      loan: p.loan,
      holdings: p.holdings,
      costBasis: p.costBasis,
      realizedPnl: p.realizedPnl ?? 0,
      unpaidRent: p.unpaidRent,
    };
    const suits = [...this.suits.values()].filter(
      (s) => s.plaintiffId === playerId || s.defendantId === playerId,
    );
    const offers = suits
      .filter((s) => s.defendantId === playerId && s.status === 'pending')
      .map((s) => ({
        id: s.id,
        kind: 'settle' as const,
        fromId: s.plaintiffId,
        toId: s.defendantId,
        suitId: s.id,
        claim: s.claim,
      }));
    const trades = [...this.trades.values()]
      .filter((t) => t.fromId === playerId || t.toId === playerId)
      .slice(-24);
    const net = netWorth(privatePlayer, this.tiles, this.prices);
    const ownActs: LogEntry[] = p.acts.map((act, index) => ({
      id: -1 - index,
      at: act.at,
      text: act.text,
      kind: 'crime',
    }));
    const ownPublic = this.log.filter((entry) => entry.text.includes(p.name));
    return {
      you: privatePlayer,
      offers,
      suits,
      trades,
      pending: p.pending,
      netWorth: net,
      loanCap: loanCap(net),
      playerLog: [...ownActs, ...ownPublic].sort((a, b) => a.at - b.at).slice(-100),
    };
  }

  // ----------------------------------------------------------------- intents

  intent(playerId: string, intent: Intent): { ok: boolean; reason?: string } {
    const p = this.players.get(playerId);
    if (!p) return { ok: false, reason: 'Unknown player.' };
    if (p.bankrupt) return { ok: false, reason: 'You are bankrupt.' };
    p.lastSeen = this.now();
    if (this.mode === 'solo' && this.activePlayerId && this.activePlayerId !== p.id) {
      return { ok: false, reason: 'Wait for your turn.' };
    }
    if ('key' in intent && intent.key) {
      const prior = p.intents.get(intent.key);
      if (prior) return prior as { ok: boolean; reason?: string };
    }
    const result = this.apply(p, intent);
    if ('key' in intent && intent.key) {
      p.intents.set(intent.key, result);
      if (p.intents.size > 200) {
        const first = p.intents.keys().next().value;
        if (first) p.intents.delete(first);
      }
    }
    if (result.ok) this.dirty = true;
    return result;
  }

  private apply(p: ServerPlayer, intent: Intent): { ok: boolean; reason?: string } {
    switch (intent.t) {
      case 'hello':
        return { ok: true };
      case 'roll':
        return this.roll(p);
      case 'buy':
        return this.buy(p, intent.tile);
      case 'decline':
        if (p.pending?.kind !== 'buy') return { ok: false, reason: 'Nothing to decline.' };
        p.pending = null;
        this.finishTurn(p);
        return { ok: true };
      case 'payRent':
        return this.payPendingRent(p);
      case 'evade':
        return this.evade(p);
      case 'build':
        return this.build(p, intent.tile, intent.type);
      case 'sellBuilding':
        return this.sellBuilding(p, intent.tile);
      case 'mortgage':
        return this.mortgage(p, intent.tile);
      case 'unmortgage':
        return this.unmortgage(p, intent.tile);
      case 'loan':
        return this.takeLoan(p, intent.amount);
      case 'repayLoan':
        return this.repayLoan(p, intent.amount);
      case 'stock':
        return this.tradeStock(p, intent.tile, intent.qty);
      case 'theft':
        return this.theft(p, intent.target);
      case 'robbery':
        return this.robbery(p, intent.amount);
      case 'murder':
        return this.murder(p, intent.target);
      case 'hireDetective':
        return this.hireDetective(p, intent.target);
      case 'sue':
        return this.sue(p, intent.target, intent.claim);
      case 'settle':
        return this.settle(p, intent.suitId);
      case 'court':
        return this.court(p, intent.suitId);
      case 'jailPay':
        return this.payJail(p);
      case 'selectToken':
        p.tokenId = intent.tokenId.slice(0, 24);
        return { ok: true };
      case 'selectColor':
        if (!TOKEN_COLORS.includes(intent.color)) return { ok: false, reason: 'Pick one of the board colours.' };
        p.color = intent.color;
        return { ok: true };
      case 'tradeOffer':
        return this.offerTrade(p, intent.targetId, intent.giveCash, intent.giveTiles, intent.wantCash, intent.wantTiles);
      case 'tradeAccept':
        return this.acceptTrade(p, intent.tradeId);
      case 'tradeDecline':
        return this.declineTrade(p, intent.tradeId);
      case 'tradeCounter':
        return this.counterTrade(p, intent.tradeId, intent.giveCash, intent.giveTiles, intent.wantCash, intent.wantTiles);
      default:
        return { ok: false, reason: 'Unknown action.' };
    }
  }

  // ------------------------------------------------------------------- roll

  private roll(p: ServerPlayer): { ok: boolean; reason?: string } {
    if (this.gameOver) return { ok: false, reason: 'This game is over.' };
    if (this.mode === 'solo' && this.activePlayerId !== p.id) return { ok: false, reason: 'Wait for your turn.' };
    const now = this.now();
    if (now - p.lastRollAt < 700) return { ok: false, reason: 'Easy — the dice are still rolling.' };
    p.lastRollAt = now;
    if (p.pending) return { ok: false, reason: 'Resolve the open offer first.' };

    if (p.inHospital) {
      p.hospitalTurns = Math.max(0, p.hospitalTurns - 1);
      if (p.hospitalTurns === 0) p.inHospital = false;
      this.logLine(`${p.name} ${p.inHospital ? `recovers (${p.hospitalTurns} turns left)` : 'leaves the hospital'}.`, 'crime');
      this.emit({ kind: 'hospital', playerId: p.id, text: p.inHospital ? `${p.hospitalTurns} turns left` : 'discharged' });
      this.seq += 1;
      this.endTurn(p);
      return { ok: true };
    }

    if (p.loan > 0) {
      const interest = loanInterest(p.loan);
      if (p.cash < interest) {
        if (!this.raiseCash(p, interest)) {
          this.bankrupt(p, null);
          return { ok: true };
        }
      }
      p.cash -= interest;
      this.logLine(`${p.name} pays ${interest} loan interest.`, 'money');
      this.emit({ kind: 'cash', playerId: p.id, amount: -interest });
    }

    if (p.inJail) {
      p.jailTurns -= 1;
      if (p.jailTurns <= 0) {
        p.inJail = false;
        p.jailTurns = 0;
        this.logLine(`${p.name} has served their term and is released.`, 'crime');
        this.emit({ kind: 'jail', playerId: p.id, text: 'released' });
      } else {
        this.emit({ kind: 'jail', playerId: p.id, text: `${p.jailTurns} turns left` });
        this.logLine(`${p.name} waits in jail (${p.jailTurns} left).`, 'crime');
      }
      this.endTurn(p);
      return { ok: true };
    }

    const d1 = 1 + Math.floor(this.rng() * 6);
    const d2 = 1 + Math.floor(this.rng() * 6);
    const dice: [number, number] = [d1, d2];
    this.emit({ kind: 'roll', playerId: p.id, dice });
    this.logLine(`${p.name} rolls ${d1} + ${d2}.`, 'info');

    if (d1 === d2) {
      p.consecutiveDoubles += 1;
      if (p.consecutiveDoubles >= 3) {
        p.consecutiveDoubles = 0;
        this.sendToJail(p, 'three doubles in a row');
        this.finishTurn(p);
        this.seq += 1;
        return { ok: true };
      }
    } else p.consecutiveDoubles = 0;

    const from = p.position;
    const next = advanceTile(from, d1 + d2);
    if (next < from) {
      p.cash += RULES.goSalary;
      this.logLine(`${p.name} passes GO and collects ${RULES.goSalary}.`, 'money');
      this.emit({ kind: 'cash', playerId: p.id, amount: RULES.goSalary });
    }
    p.position = next;
    this.emit({ kind: 'move', playerId: p.id, tile: next });
    this.resolveLanding(p, next, d1 + d2);
    p.extraRoll = d1 === d2;
    if (this.mode === 'solo' && !p.pending) this.finishTurn(p);
    this.seq += 1;
    return { ok: true };
  }

  /** Advances a solo table after the active player's roll and any offer. */
  private finishTurn(p: ServerPlayer): void {
    if (this.mode !== 'solo' || this.activePlayerId !== p.id || p.pending) return;
    if (p.extraRoll) {
      p.extraRoll = false;
      this.emit({ kind: 'turn', playerId: p.id, text: 'doubles — roll again' });
      this.seq += 1;
      return;
    }
    this.endTurn(p);
  }

  private endTurn(p: ServerPlayer): void {
    if (this.mode !== 'solo') return;
    p.extraRoll = false;
    if (this.gameOver) return;
    const alive = [...this.players.values()].filter((q) => !q.bankrupt);
    if (!alive.length) return;
    const index = alive.findIndex((q) => q.id === p.id);
    const next = alive[(index + 1) % alive.length]!;
    this.activePlayerId = next.id;
    this.turnNumber += 1;
    this.turnStartedAt = this.now();
    this.logLine(`${next.name}'s turn.`, 'info');
    this.emit({ kind: 'turn', playerId: next.id, text: `${next.name}'s turn` });
    this.seq += 1;
  }

  private resolveLanding(p: ServerPlayer, tile: number, dice: number): void {
    const space = spaceAt(tile);
    const state = this.tiles[tile]!;
    switch (space.type) {
      case 'property':
      case 'railroad':
      case 'utility': {
        if (!state.ownerId) {
          p.pending = { kind: 'buy', tile, amount: space.price, expiresAt: this.now() + 25_000 };
          this.emit({ kind: 'purchase', playerId: p.id, tile, text: 'offer' });
          return;
        }
        if (state.ownerId === p.id || state.mortgaged) return;
        const rent = rentFor(tile, this.tiles, dice);
        p.pending = {
          kind: 'rent',
          tile,
          amount: rent,
          ownerId: state.ownerId,
          expiresAt: this.now() + 25_000,
        };
        this.emit({ kind: 'rent', playerId: p.id, tile, amount: rent });
        return;
      }
      case 'tax': {
        const amount = space.tax ?? 0;
        this.charge(p, amount, null);
        this.logLine(`${p.name} pays ${space.name} of ${amount}.`, 'money');
        return;
      }
      case 'chance':
      case 'chest': {
        this.drawCard(p, space.type === 'chance' ? 'chance' : 'chest');
        return;
      }
      case 'gotojail':
        this.sendToJail(p, 'Go To Jail');
        return;
      case 'go':
        p.cash += RULES.goSalary;
        this.logLine(`${p.name} lands on GO and collects ${RULES.goSalary}.`, 'money');
        return;
      default:
        return;
    }
  }

  private drawCard(p: ServerPlayer, deck: 'chance' | 'chest'): void {
    const pool = CARDS.filter((c) => c.deck === deck);
    const card = pool[Math.floor(this.rng() * pool.length)] as Card;
    this.logLine(`${p.name} draws "${card.text}"`, 'info');
    this.emit({ kind: 'card', playerId: p.id, text: card.text, deck });
    const effect = card.effect;
    switch (effect.kind) {
      case 'cash':
        if (effect.amount >= 0) p.cash += effect.amount;
        else this.charge(p, -effect.amount, null);
        break;
      case 'move': {
        const wrapped = effect.to < p.position;
        p.position = effect.to;
        if (wrapped && effect.collectGo) p.cash += RULES.goSalary;
        this.resolveLanding(p, effect.to, 7);
        break;
      }
      case 'jail':
        this.sendToJail(p, 'a card');
        break;
      case 'jailFree':
        p.jailFree += 1;
        break;
      case 'advanceNearestRail': {
        const rails = SPACES.filter((s) => s.type === 'railroad').map((s) => s.index);
        const target = rails.find((i) => i > p.position) ?? rails[0]!;
        p.position = target;
        const st = this.tiles[target]!;
        if (st.ownerId && st.ownerId !== p.id && !st.mortgaged) {
          const rent = rentFor(target, this.tiles, 7) * 2;
          this.charge(p, rent, st.ownerId);
        } else this.resolveLanding(p, target, 7);
        break;
      }
      case 'repair': {
        const owned = Object.values(this.tiles).filter((t) => t.ownerId === p.id && t.building).length;
        this.charge(p, owned * effect.perBuilding, null);
        break;
      }
    }
  }

  private sendToJail(p: ServerPlayer, reason: string): void {
    // A jailed player's portfolio can change, so no open trade may survive it.
    this.cancelTradesFor(p.id);
    // Buildings are always liquidated at half. Then the jail meter decides which
    // deeds the bank takes outright; the rest are mortgaged.
    let refund = 0;
    for (const [idx, t] of Object.entries(this.tiles)) {
      if (t.ownerId !== p.id || !t.building) continue;
      refund += Math.round(buildingCost(spaceAt(Number(idx)), t.building) * RULES.sellRefund);
      t.building = null;
      this.buildingCount = Math.max(0, this.buildingCount - 1);
    }
    p.cash += refund;

    const owned = Object.entries(this.tiles)
      .filter(([idx, t]) => t.ownerId === p.id && spaceAt(Number(idx)).price > 0)
      .map(([idx]) => Number(idx));
    const rollPercent = this.rng() * 100;
    let outcome: 'all' | 'some' | 'none' = 'none';
    let sold: number[] = [];
    if (owned.length && rollPercent < 25) outcome = 'all';
    else if (owned.length && rollPercent < 65) outcome = 'some';

    if (outcome === 'all') sold = owned;
    else if (outcome === 'some') {
      const shuffled = [...owned].sort(() => this.rng() - 0.5);
      const count = Math.max(1, Math.min(owned.length - 1, Math.round(owned.length / 2)));
      sold = shuffled.slice(0, count);
    }

    for (const idx of owned) {
      const t = this.tiles[idx]!;
      if (sold.includes(idx)) {
        t.ownerId = null;
        t.mortgaged = false;
        t.building = null;
        t.shares = {};
        t.lockedBy = null;
      } else if (!t.mortgaged) {
        t.mortgaged = true;
        p.cash += mortgageValue(spaceAt(idx));
      }
    }

    p.position = 10;
    p.inJail = true;
    p.jailTurns = RULES.jailTurns;
    p.jailCause = reason;
    p.jailOutcome = outcome;
    p.jailSold = sold;
    p.jailReleaseCost = this.jailReleaseCost(p);
    p.pending = null;
    p.extraRoll = false;
    const soldLabel = outcome === 'all' ? 'all deeds sold' : outcome === 'some' ? `${sold.length} deed${sold.length === 1 ? '' : 's'} sold` : 'deeds mortgaged';
    const chance: ChanceRoll = {
      label: 'Jail property sale',
      percent: 100,
      success: outcome !== 'none',
      rollPercent,
      result: outcome === 'none' ? 'None sold — deeds mortgaged' : outcome === 'all' ? 'All properties sold' : `Some sold (${sold.length})`,
      zones: [
        { key: 'all', label: 'All sold', percent: 25 },
        { key: 'some', label: 'Some sold', percent: 40 },
        { key: 'none', label: 'None sold', percent: 35 },
      ],
    };
    const fullRecord = p.acts.map((act) => act.text).join(' ') || 'no prior record';
    this.logLine(`${p.name} is jailed for ${reason}. Public record: ${fullRecord} Sale outcome: ${soldLabel}.`, 'crime');
    this.emit({ kind: 'jail', playerId: p.id, text: `${reason} · ${soldLabel}`, chance });
    this.seq += 1;
  }

  private jailReleaseCost(p: ServerPlayer): number {
    let total = 0;
    for (const [idx, t] of Object.entries(this.tiles)) {
      if (t.ownerId === p.id && t.mortgaged) total += unmortgageCost(spaceAt(Number(idx)));
    }
    return total;
  }

  // --------------------------------------------------------------- purchases

  private buy(p: ServerPlayer, tile: number): { ok: boolean; reason?: string } {
    if (p.pending?.kind !== 'buy' || p.pending.tile !== tile) return { ok: false, reason: 'No purchase offer for that property.' };
    if (p.inJail) return { ok: false, reason: 'You cannot buy while jailed.' };
    const space = spaceAt(tile);
    const state = this.tiles[tile]!;
    // Atomic check-and-set: the loser is told instead of overwriting the owner.
    if (state.ownerId) {
      p.pending = null;
      this.finishTurn(p);
      return { ok: false, reason: 'already_owned' };
    }
    if (p.cash < space.price) return { ok: false, reason: 'Not enough cash.' };
    p.cash -= space.price;
    state.ownerId = p.id;
    p.pending = null;
    this.logLine(`${p.name} buys ${space.name} for ${space.price}.`, 'money');
    this.emit({ kind: 'purchase', playerId: p.id, tile, amount: space.price });
    this.finishTurn(p);
    this.seq += 1;
    return { ok: true };
  }

  private payPendingRent(p: ServerPlayer): { ok: boolean; reason?: string } {
    if (p.pending?.kind !== 'rent') return { ok: false, reason: 'No rent is due.' };
    const { tile, amount, ownerId } = p.pending;
    p.pending = null;
    this.payRent(p, tile, amount, ownerId ?? null, false);
    this.finishTurn(p);
    return { ok: true };
  }

  private evade(p: ServerPlayer): { ok: boolean; reason?: string } {
    if (p.pending?.kind !== 'rent') return { ok: false, reason: 'No rent is due.' };
    const { tile, amount, ownerId } = p.pending;
    p.pending = null;
    const buildings = this.tiles[tile]?.building ? 1 : 0;
    const percent = evadeChance(buildings);
    const rollPercent = (this.rollTest() ?? this.rng()) * 100;
    const success = rollPercent < percent * 100;
    const chance: ChanceRoll = {
      label: 'Rent evasion',
      percent: Math.round(percent * 100),
      success,
      rollPercent,
      result: success ? 'Slipped away' : 'Caught',
    };
    if (success) {
      p.reputation = applyReputation(p.reputation, -RULES.evadeSuccessRep);
      p.unpaidRent += amount;
      p.jailRecord.push({ tile, amount, at: this.now() });
      this.recordAct(p, `Evaded rent at ${spaceAt(tile).name} (${amount}).`);
      this.logLine(`${p.name} slips away without paying rent at ${spaceAt(tile).name}.`, 'crime');
      this.emit({ kind: 'rent', playerId: p.id, tile, amount: 0, text: 'evaded', chance });
    } else {
      const owed = Math.round(amount * (1 + RULES.evadePenalty));
      p.reputation = applyReputation(p.reputation, -RULES.evadeCaughtRep);
      this.recordAct(p, `Caught evading rent at ${spaceAt(tile).name}.`);
      this.payRent(p, tile, owed, ownerId ?? null, false);
      this.logLine(`${p.name} is caught evading and pays ${owed}.`, 'crime');
      this.emit({ kind: 'rent', playerId: p.id, tile, amount: owed, text: 'caught', chance });
    }
    this.finishTurn(p);
    this.seq += 1;
    return { ok: true };
  }

  private payRent(p: ServerPlayer, tile: number, amount: number, ownerId: string | null, _penalty: boolean): void {
    this.charge(p, amount, ownerId);
    const state = this.tiles[tile]!;
    if (!ownerId || state.mortgaged) return;
    const ownerPlayer = this.players.get(ownerId);
    const { holders } = dividendSplit(amount, state.shares);
    if (ownerPlayer) {
      for (const [id, share] of Object.entries(holders)) {
        const holder = this.players.get(id);
        if (!holder || holder.bankrupt || holder.id === ownerId) continue;
        const paid = Math.min(ownerPlayer.cash, share);
        ownerPlayer.cash -= paid;
        holder.cash += paid;
        this.emit({ kind: 'cash', playerId: id, amount: paid });
      }
      if (ownerPlayer.id !== p.id) {
        ownerPlayer.reputation = applyReputation(ownerPlayer.reputation, RULES.payRentRep);
      }
    }
    this.emit({ kind: 'cash', playerId: p.id, amount: -amount });
    this.seq += 1;
  }

  /** Deducts cash, auto-mortgaging then bankrupting as the brief requires. */
  private charge(p: ServerPlayer, amount: number, creditorId: string | null): void {
    if (amount <= 0) return;
    if (p.cash >= amount) {
      p.cash -= amount;
      if (creditorId) {
        const c = this.players.get(creditorId);
        if (c) c.cash += amount;
      }
      return;
    }
    const shortfall = amount - p.cash;
    if (!this.raiseCash(p, shortfall)) {
      const paid = p.cash;
      p.cash = 0;
      if (creditorId) {
        const c = this.players.get(creditorId);
        if (c) c.cash += paid;
      }
      this.bankrupt(p, creditorId);
      return;
    }
    p.cash -= amount;
    if (creditorId) {
      const c = this.players.get(creditorId);
      if (c) c.cash += amount;
    }
  }

  /** Mortgages the lowest-value properties until `need` is covered. */
  private raiseCash(p: ServerPlayer, need: number): boolean {
    const owned = Object.entries(this.tiles)
      .filter(([, t]) => t.ownerId === p.id && !t.mortgaged)
      .map(([idx]) => spaceAt(Number(idx)))
      .sort((a, b) => a.price - b.price);
    for (const space of owned) {
      if (p.cash >= need) return true;
      const t = this.tiles[space.index]!;
      t.mortgaged = true;
      p.cash += mortgageValue(space);
      this.logLine(`${p.name} auto-mortgages ${space.name} for ${mortgageValue(space)}.`, 'money');
    }
    return p.cash >= need;
  }

  private bankrupt(p: ServerPlayer, creditorId: string | null): void {
    p.bankrupt = true;
    this.cancelTradesFor(p.id);
    for (const t of Object.values(this.tiles)) {
      if (t.ownerId !== p.id) continue;
      if (t.building) this.buildingCount = Math.max(0, this.buildingCount - 1);
      t.ownerId = creditorId;
      t.building = null;
      t.mortgaged = false;
      t.lockedBy = null;
    }
    p.pending = null;
    this.logLine(`${p.name} is bankrupt.`, 'money');
    this.emit({ kind: 'cash', playerId: p.id, amount: -1 });
    const alive = [...this.players.values()].filter((player) => !player.bankrupt);
    if (this.players.size >= 2 && alive.length <= 1 && !this.gameOver) {
      this.gameOver = { winnerId: alive[0]?.id ?? '', at: this.now() };
      this.logLine(`${alive[0]?.name ?? 'Nobody'} owns the board.`, 'money');
      this.emit({ kind: 'win', playerId: alive[0]?.id });
    }
  }

  // ------------------------------------------------------------------ build

  private build(p: ServerPlayer, tile: number, type: BuildingType): { ok: boolean; reason?: string } {
    const check = canBuild(tile, this.tiles, p.id, this.buildingCount, this.mode, type);
    if (!check.ok) return check;
    const space = spaceAt(tile);
    const state = this.tiles[tile]!;
    if (state.lockedBy) return { ok: false, reason: 'This property is locked by a pending deal.' };
    const cost = buildingCost(space, type);
    const refund = state.building ? Math.round(buildingCost(space, state.building) * RULES.sellRefund) : 0;
    if (p.cash + refund < cost) {
      return { ok: false, reason: `You need ${cost} to build a ${BUILDING_META[type].name}.` };
    }
    if (state.building) {
      p.cash += refund;
      this.buildingCount = Math.max(0, this.buildingCount - 1);
    }
    p.cash -= cost;
    state.building = type;
    this.buildingCount += 1;
    this.logLine(`${p.name} builds a ${BUILDING_META[type].name} on ${space.name}${refund ? ` (replaced, ${refund} refunded)` : ''}.`, 'build');
    this.emit({ kind: 'build', playerId: p.id, tile });
    this.seq += 1;
    return { ok: true };
  }

  private sellBuilding(p: ServerPlayer, tile: number): { ok: boolean; reason?: string } {
    const state = this.tiles[tile]!;
    if (state.ownerId !== p.id || !state.building) return { ok: false, reason: 'No building of yours here.' };
    if (state.lockedBy) return { ok: false, reason: 'This property is locked by a pending deal.' };
    const space = spaceAt(tile);
    const refund = Math.round(buildingCost(space, state.building) * RULES.sellRefund);
    p.cash += refund;
    state.building = null;
    this.buildingCount = Math.max(0, this.buildingCount - 1);
    this.logLine(`${p.name} sells a building on ${space.name} for ${refund}.`, 'build');
    this.seq += 1;
    return { ok: true };
  }

  private mortgage(p: ServerPlayer, tile: number): { ok: boolean; reason?: string } {
    const space = spaceAt(tile);
    const state = this.tiles[tile]!;
    if (state.ownerId !== p.id) return { ok: false, reason: 'You do not own this property.' };
    if (state.mortgaged) return { ok: false, reason: 'Already mortgaged.' };
    if (state.building) return { ok: false, reason: 'Sell the building first.' };
    if (state.lockedBy) return { ok: false, reason: 'This property is locked by a pending deal.' };
    state.mortgaged = true;
    p.cash += mortgageValue(space);
    this.logLine(`${p.name} mortgages ${space.name} for ${mortgageValue(space)}.`, 'money');
    this.seq += 1;
    return { ok: true };
  }

  private unmortgage(p: ServerPlayer, tile: number): { ok: boolean; reason?: string } {
    const space = spaceAt(tile);
    const state = this.tiles[tile]!;
    if (state.ownerId !== p.id) return { ok: false, reason: 'You do not own this property.' };
    if (!state.mortgaged) return { ok: false, reason: 'Not mortgaged.' };
    if (state.lockedBy) return { ok: false, reason: 'This property is locked by a pending deal.' };
    const cost = unmortgageCost(space);
    if (p.cash < cost) return { ok: false, reason: `You need ${cost}.` };
    p.cash -= cost;
    state.mortgaged = false;
    this.logLine(`${p.name} unmortgages ${space.name} for ${cost}.`, 'money');
    this.seq += 1;
    return { ok: true };
  }

  // ------------------------------------------------------------------ trades

  private tradeValue(side: TradeOffer['give']): number {
    let total = Math.max(0, Math.round(side.cash));
    for (const tile of side.properties) {
      const state = this.tiles[tile];
      if (!state) continue;
      const space = spaceAt(tile);
      total += state.mortgaged ? Math.round(space.price * 0.5) : space.price;
      if (state.building) total += Math.round(buildingCost(space, state.building) * 0.5);
    }
    return total;
  }

  private cleanTradeSide(
    ownerId: string,
    cash: number,
    properties: number[],
    allowLock?: string,
  ): { ok: true; side: TradeOffer['give'] } | { ok: false; reason: string } {
    if (!Number.isFinite(cash) || cash < 0 || !Number.isInteger(cash)) {
      return { ok: false, reason: 'Trade cash must be a whole number of dollars.' };
    }
    if (!Array.isArray(properties) || properties.length > 12) {
      return { ok: false, reason: 'A trade can include up to 12 properties per side.' };
    }
    if (new Set(properties).size !== properties.length) {
      return { ok: false, reason: 'A property can only appear once in a trade.' };
    }
    for (const tile of properties) {
      if (!Number.isInteger(tile) || !this.tiles[tile]) return { ok: false, reason: 'That property is not on the board.' };
      const state = this.tiles[tile]!;
      if (!spaceAt(tile).price) return { ok: false, reason: `${spaceAt(tile).name} cannot be traded.` };
      if (state.ownerId !== ownerId) return { ok: false, reason: `You do not own ${spaceAt(tile).name}.` };
      if (state.lockedBy && state.lockedBy !== allowLock) return { ok: false, reason: `${spaceAt(tile).name} is locked by another deal.` };
    }
    if (cash === 0 && properties.length === 0) return { ok: false, reason: 'A trade needs something from each side.' };
    return { ok: true, side: { cash, properties: [...properties].sort((a, b) => a - b) } };
  }

  private releaseTrade(trade: TradeOffer, status: TradeOffer['status']): void {
    trade.status = status;
    for (const tile of [...trade.give.properties, ...trade.want.properties]) {
      const state = this.tiles[tile];
      if (state?.lockedBy === `trade:${trade.id}`) state.lockedBy = null;
    }
    this.botTradeAt.delete(trade.id);
    this.seq += 1;
    this.dirty = true;
  }

  private makeTrade(from: ServerPlayer, to: ServerPlayer, give: TradeOffer['give'], want: TradeOffer['give']): TradeOffer {
    const id = uid('trade');
    const trade: TradeOffer = {
      id,
      fromId: from.id,
      toId: to.id,
      give,
      want,
      status: 'pending',
      createdAt: this.now(),
      expiresAt: this.now() + 120_000,
    };
    this.trades.set(id, trade);
    for (const tile of [...give.properties, ...want.properties]) this.tiles[tile]!.lockedBy = `trade:${id}`;
    if (to.isBot) this.botTradeAt.set(id, this.now() + 1300);
    this.logLine(`${from.name} offers ${to.name} a trade.`, 'info');
    this.emit({ kind: 'trade', playerId: from.id, targetId: to.id, audience: [from.id, to.id], text: 'offer', amount: give.cash + want.cash });
    this.seq += 1;
    this.dirty = true;
    return trade;
  }

  private offerTrade(
    p: ServerPlayer,
    targetId: string,
    giveCash: number,
    giveTiles: number[],
    wantCash: number,
    wantTiles: number[],
  ): { ok: boolean; reason?: string } {
    const target = this.players.get(targetId);
    if (!target || target.bankrupt || target.id === p.id) return { ok: false, reason: 'Pick another player to trade with.' };
    if (p.cash < giveCash) return { ok: false, reason: 'You do not have that much cash.' };
    if (target.cash < wantCash) return { ok: false, reason: `${target.name} does not have that much cash.` };
    const give = this.cleanTradeSide(p.id, giveCash, giveTiles);
    if (!give.ok) return give;
    const want = this.cleanTradeSide(target.id, wantCash, wantTiles);
    if (!want.ok) return want;
    const pending = [...this.trades.values()].filter((t) => t.status === 'pending' && (t.fromId === p.id || t.toId === p.id));
    if (pending.length >= 6) return { ok: false, reason: 'Resolve an open trade before starting another.' };
    this.makeTrade(p, target, give.side, want.side);
    return { ok: true };
  }

  private acceptTrade(p: ServerPlayer, tradeId: string): { ok: boolean; reason?: string } {
    const trade = this.trades.get(tradeId);
    if (!trade || trade.status !== 'pending') return { ok: false, reason: 'That offer is no longer open.' };
    if (trade.toId !== p.id) return { ok: false, reason: 'Only the recipient can accept this offer.' };
    if (this.now() > trade.expiresAt) {
      this.releaseTrade(trade, 'expired');
      return { ok: false, reason: 'That offer has expired.' };
    }
    const from = this.players.get(trade.fromId);
    if (!from || from.bankrupt) return { ok: false, reason: 'The other player has left the board.' };
    if (from.cash < trade.give.cash || p.cash < trade.want.cash) {
      return { ok: false, reason: 'Cash changed while the offer was open. Adjust the trade.' };
    }
    for (const tile of trade.give.properties) {
      const state = this.tiles[tile]!;
      if (state.ownerId !== from.id || state.lockedBy !== `trade:${trade.id}`) {
        return { ok: false, reason: `The deal is stale: ${spaceAt(tile).name} changed hands.` };
      }
    }
    for (const tile of trade.want.properties) {
      const state = this.tiles[tile]!;
      if (state.ownerId !== p.id || state.lockedBy !== `trade:${trade.id}`) {
        return { ok: false, reason: `The deal is stale: ${spaceAt(tile).name} changed hands.` };
      }
    }
    // Validation is complete; the cash and property swap is one synchronous step.
    from.cash -= trade.give.cash;
    p.cash += trade.give.cash;
    p.cash -= trade.want.cash;
    from.cash += trade.want.cash;
    for (const tile of trade.give.properties) this.tiles[tile]!.ownerId = p.id;
    for (const tile of trade.want.properties) this.tiles[tile]!.ownerId = from.id;
    trade.status = 'accepted';
    this.botTradeAt.delete(trade.id);
    for (const tile of [...trade.give.properties, ...trade.want.properties]) this.tiles[tile]!.lockedBy = null;
    this.logLine(`${p.name} accepts a trade with ${from.name}.`, 'money');
    this.emit({ kind: 'trade', playerId: p.id, targetId: from.id, audience: [from.id, p.id], text: 'accepted', amount: trade.give.cash + trade.want.cash });
    this.seq += 1;
    this.dirty = true;
    return { ok: true };
  }

  private declineTrade(p: ServerPlayer, tradeId: string): { ok: boolean; reason?: string } {
    const trade = this.trades.get(tradeId);
    if (!trade || trade.status !== 'pending') return { ok: false, reason: 'That offer is no longer open.' };
    if (trade.fromId !== p.id && trade.toId !== p.id) return { ok: false, reason: 'That is not your offer.' };
    this.releaseTrade(trade, 'declined');
    this.emit({ kind: 'trade', playerId: p.id, targetId: trade.fromId === p.id ? trade.toId : trade.fromId, audience: [trade.fromId, trade.toId], text: 'declined' });
    return { ok: true };
  }

  private counterTrade(
    p: ServerPlayer,
    tradeId: string,
    giveCash: number,
    giveTiles: number[],
    wantCash: number,
    wantTiles: number[],
  ): { ok: boolean; reason?: string } {
    const old = this.trades.get(tradeId);
    if (!old || old.status !== 'pending') return { ok: false, reason: 'That offer is no longer open.' };
    if (old.toId !== p.id) return { ok: false, reason: 'Only the recipient can counter this offer.' };
    const other = this.players.get(old.fromId);
    if (!other || other.bankrupt) return { ok: false, reason: 'The other player has left the board.' };
    if (p.cash < giveCash) return { ok: false, reason: 'You do not have that much cash.' };
    if (other.cash < wantCash) return { ok: false, reason: `${other.name} does not have that much cash.` };
    const give = this.cleanTradeSide(p.id, giveCash, giveTiles, `trade:${old.id}`);
    if (!give.ok) return give;
    const want = this.cleanTradeSide(other.id, wantCash, wantTiles, `trade:${old.id}`);
    if (!want.ok) return want;
    for (const tile of [...old.give.properties, ...old.want.properties]) {
      const state = this.tiles[tile];
      if (state?.lockedBy === `trade:${old.id}`) state.lockedBy = null;
    }
    old.status = 'countered';
    this.botTradeAt.delete(old.id);
    this.makeTrade(p, other, give.side, want.side);
    this.emit({ kind: 'trade', playerId: p.id, targetId: other.id, audience: [p.id, other.id], text: 'countered' });
    return { ok: true };
  }

  private expireTrades(): void {
    for (const trade of this.trades.values()) {
      if (trade.status !== 'pending' || this.now() <= trade.expiresAt) continue;
      this.releaseTrade(trade, 'expired');
      this.emit({ kind: 'trade', playerId: trade.fromId, targetId: trade.toId, audience: [trade.fromId, trade.toId], text: 'expired' });
    }
  }

  private decideBotTrades(now: number): void {
    for (const trade of [...this.trades.values()]) {
      if (trade.status !== 'pending') continue;
      const bot = this.players.get(trade.toId);
      if (!bot?.isBot) continue;
      const at = this.botTradeAt.get(trade.id) ?? now;
      if (now < at) continue;
      const giveValue = this.tradeValue(trade.give);
      const wantValue = this.tradeValue(trade.want);
      if (giveValue >= wantValue * 0.9) this.acceptTrade(bot, trade.id);
      else this.declineTrade(bot, trade.id);
    }
  }

  private cancelTradesFor(playerId: string): void {
    for (const trade of this.trades.values()) {
      if (trade.status !== 'pending' || (trade.fromId !== playerId && trade.toId !== playerId)) continue;
      trade.status = 'cancelled';
      for (const tile of [...trade.give.properties, ...trade.want.properties]) {
        const state = this.tiles[tile];
        if (state?.lockedBy === `trade:${trade.id}`) state.lockedBy = null;
      }
      this.botTradeAt.delete(trade.id);
    }
  }

  /** Drops any multiplayer seat that is not backed by a real account. */
  purgeUnauthenticated(accountIds: Set<string>): void {
    if (this.mode !== 'multi') return;
    for (const p of [...this.players.values()]) {
      if (accountIds.has(p.id)) continue;
      this.cancelTradesFor(p.id);
      for (const t of Object.values(this.tiles)) {
        if (t.ownerId !== p.id) continue;
        if (t.building) this.buildingCount = Math.max(0, this.buildingCount - 1);
        t.ownerId = null;
        t.building = null;
        t.mortgaged = false;
        t.shares = {};
        t.lockedBy = null;
      }
      this.players.delete(p.id);
    }
  }

  /** Removes any legacy bot seats and returns their deeds to the bank. */
  purgeBots(): void {
    for (const p of [...this.players.values()]) {
      if (!p.isBot) continue;
      this.cancelTradesFor(p.id);
      for (const t of Object.values(this.tiles)) {
        if (t.ownerId !== p.id) continue;
        if (t.building) this.buildingCount = Math.max(0, this.buildingCount - 1);
        t.ownerId = null;
        t.building = null;
        t.mortgaged = false;
        t.shares = {};
        t.lockedBy = null;
      }
      this.players.delete(p.id);
    }
    if (this.activePlayerId && !this.players.has(this.activePlayerId)) {
      this.activePlayerId = [...this.players.values()].find((p) => !p.isBot)?.id ?? null;
    }
  }

  // ------------------------------------------------------------------- loans

  private takeLoan(p: ServerPlayer, amount: number): { ok: boolean; reason?: string } {
    const privatePlayer = this.privateState(p.id).you;
    const cap = loanCap(netWorth(privatePlayer, this.tiles, this.prices));
    if (amount < 200) return { ok: false, reason: 'Minimum loan is $200.' };
    if (p.loan + amount > cap) {
      return {
        ok: false,
        reason: `Loan limit is ${cap.toLocaleString('en-US')}. You asked for ${(p.loan + amount).toLocaleString('en-US')}.`,
      };
    }
    p.loan += amount;
    p.cash += amount;
    this.logLine(`${p.name} borrows ${amount} from the bank.`, 'money');
    this.emit({ kind: 'loan', playerId: p.id, amount });
    this.seq += 1;
    return { ok: true };
  }

  private repayLoan(p: ServerPlayer, amount: number): { ok: boolean; reason?: string } {
    const pay = Math.min(amount, p.loan, p.cash);
    if (pay <= 0) return { ok: false, reason: 'Nothing to repay.' };
    p.cash -= pay;
    p.loan -= pay;
    this.logLine(`${p.name} repays ${pay} of their loan.`, 'money');
    this.seq += 1;
    return { ok: true };
  }

  // ------------------------------------------------------------------ stocks

  private tradeStock(p: ServerPlayer, tile: number, qty: number): { ok: boolean; reason?: string } {
    if (!Number.isInteger(qty) || qty === 0) return { ok: false, reason: 'Choose a whole number of shares.' };
    const space = spaceAt(tile);
    if (!space.price) return { ok: false, reason: 'That space has no stock.' };
    const price = this.prices[tile]!;
    const state = this.tiles[tile]!;
    const key = String(tile);
    const held = p.holdings[key] ?? 0;
    const purchase = qty > 0;
    const cost = Math.abs(qty) * price;
    if (purchase) {
      if (p.cash < cost) return { ok: false, reason: `You need ${Math.round(cost)}.` };
      if (state.ownerId !== p.id) {
        const external = Object.entries(state.shares)
          .filter(([id]) => id !== state.ownerId)
          .reduce((a, [, v]) => a + v, 0);
        if (external + qty / 1000 > RULES.externalMax) return { ok: false, reason: 'External ownership is capped at 50%.' };
      }
      p.cash -= cost;
      state.shares[p.id] = (state.shares[p.id] ?? 0) + qty / 1000;
      p.holdings[key] = held + qty;
      p.costBasis[key] = (p.costBasis[key] ?? 0) + cost;
      this.volumes[tile] = (this.volumes[tile] ?? 0) + qty;
    } else {
      const sell = -qty;
      if (sell > held) return { ok: false, reason: `You only hold ${held} shares.` };
      const basis = p.costBasis[key] ?? 0;
      const average = held > 0 ? basis / held : price;
      p.cash += sell * price;
      p.realizedPnl += (price - average) * sell;
      state.shares[p.id] = Math.max(0, (state.shares[p.id] ?? 0) - sell / 1000);
      p.holdings[key] = held - sell;
      p.costBasis[key] = Math.max(0, basis - average * sell);
      if (p.holdings[key] === 0) {
        delete p.holdings[key];
        delete p.costBasis[key];
      }
      this.volumes[tile] = (this.volumes[tile] ?? 0) - sell;
    }
    const fund = fundamental(tile, this.tiles);
    const impact = Math.max(-0.04, Math.min(0.04, qty / 2500));
    const before = this.prices[tile]!;
    const after = clampPrice(before * (1 + impact), fund);
    this.prices[tile] = after;
    this.recordPrice(tile, before, after);
    this.emit({ kind: 'stock', playerId: p.id, tile, amount: qty });
    this.seq += 1;
    return { ok: true };
  }

  // ------------------------------------------------------------------- crime

  private theft(p: ServerPlayer, target: string): { ok: boolean; reason?: string } {
    if (this.now() - p.lastTheftAt < 4000) return { ok: false, reason: 'The heat is still on — wait a moment.' };
    const victim = this.players.get(target);
    if (!victim || victim.bankrupt) return { ok: false, reason: 'That player is not on the board.' };
    p.lastTheftAt = this.now();
    const repBefore = p.reputation;
    p.reputation = applyReputation(p.reputation, -RULES.theftAttemptRep);
    const percent = playerTheftChance() * 100;
    const rollPercent = (this.rollTest() ?? this.rng()) * 100;
    const success = rollPercent < percent;
    const chance: ChanceRoll = {
      label: `Rob ${victim.name}`,
      percent: Math.round(percent),
      success,
      rollPercent,
      result: success ? 'Clean getaway' : 'Caught',
    };
    if (success) {
      const amount = Math.min(RULES.playerTheftCap, Math.floor(victim.cash * 0.25));
      victim.cash -= amount;
      p.cash += amount;
      p.reputation = applyReputation(p.reputation, -Math.round(amount / 100));
      this.recordAct(p, `Stole ${amount} from ${victim.name}.`);
      // Successful underworld actions never reach the public log.
      this.emit({
        kind: 'theft',
        playerId: p.id,
        targetId: victim.id,
        audience: [p.id, victim.id],
        amount,
        text: 'player success',
        chance,
        outcome: {
          success: true,
          kind: 'theft',
          amount,
          targetName: victim.name,
          reputationDelta: p.reputation - repBefore,
          detail: `You lifted ${amount} from ${victim.name}.`,
        },
      });
      this.emit({ kind: 'cash', playerId: victim.id, amount: -amount, audience: [victim.id] });
    } else {
      p.reputation = applyReputation(p.reputation, -RULES.theftRepLoss);
      this.recordAct(p, `Failed robbery of ${victim.name} and was jailed.`);
      this.emit({
        kind: 'theft',
        playerId: p.id,
        targetId: victim.id,
        audience: [p.id],
        amount: 0,
        text: 'attempted',
        chance,
        outcome: {
          success: false,
          kind: 'theft',
          amount: 0,
          targetName: victim.name,
          reputationDelta: p.reputation - repBefore,
          detail: `The robbery of ${victim.name} failed. You are going to jail.`,
        },
      });
      this.sendToJail(p, 'a failed robbery');
    }
    this.seq += 1;
    return { ok: true };
  }

  private robbery(p: ServerPlayer, amount: number): { ok: boolean; reason?: string } {
    const chosen = Math.round(amount);
    const issue = robberyAmountIssues(chosen);
    if (issue) return { ok: false, reason: issue };
    if (this.now() - p.lastTheftAt < 4000) return { ok: false, reason: 'The heat is still on — wait a moment.' };
    p.lastTheftAt = this.now();
    const repBefore = p.reputation;
    p.reputation = applyReputation(p.reputation, -RULES.theftAttemptRep);
    const percent = robberyChance(chosen) * 100;
    const rollPercent = (this.rollTest() ?? this.rng()) * 100;
    const success = rollPercent < percent;
    const chance: ChanceRoll = {
      label: `Bank robbery · ${chosen.toLocaleString('en-US')}`,
      percent: Math.round(percent * 10) / 10,
      success,
      rollPercent,
      result: success ? `Got away with ${chosen.toLocaleString('en-US')}` : 'Caught',
    };
    if (success) {
      p.cash += chosen;
      this.recordAct(p, `Robbed the bank for ${chosen}.`);
      this.emit({
        kind: 'theft',
        playerId: p.id,
        audience: [p.id],
        amount: chosen,
        text: 'bank success',
        chance,
        outcome: {
          success: true,
          kind: 'robbery',
          amount: chosen,
          reputationDelta: p.reputation - repBefore,
          detail: `You walked out with exactly ${chosen}.`,
        },
      });
    } else {
      p.reputation = applyReputation(p.reputation, -RULES.theftRepLoss);
      this.recordAct(p, `Failed ${chosen} bank robbery and was jailed.`);
      this.emit({
        kind: 'theft',
        playerId: p.id,
        audience: [p.id],
        amount: 0,
        text: 'bank fail',
        chance,
        outcome: {
          success: false,
          kind: 'robbery',
          amount: 0,
          reputationDelta: p.reputation - repBefore,
          detail: `The vault door closed on you. You are going to jail.`,
        },
      });
      this.sendToJail(p, 'a failed bank robbery');
    }
    this.seq += 1;
    return { ok: true };
  }

  private hireDetective(p: ServerPlayer, target: string): { ok: boolean; reason?: string } {
    const victim = this.players.get(target);
    if (!victim || victim.bankrupt || victim.id === p.id) return { ok: false, reason: 'Pick another player.' };
    if (p.cash < RULES.detectiveFee) return { ok: false, reason: `A detective costs ${RULES.detectiveFee}.` };
    p.cash -= RULES.detectiveFee;
    const percent = RULES.detectiveChance * 100;
    const rollPercent = (this.rollTest() ?? this.rng()) * 100;
    const success = rollPercent < percent;
    const chance: ChanceRoll = {
      label: `Detective on ${victim.name}`,
      percent: Math.round(percent),
      success,
      rollPercent,
      result: success ? 'Record revealed' : 'Nothing found',
    };
    if (success) {
      p.findings[target] = (p.findings[target] ?? 0) + 1;
      p.dossier[target] = {
        reputation: victim.reputation,
        evidence: evidenceStrength(victim.unpaidRent, p.findings[target] ?? 1),
        at: this.now(),
        record: victim.jailRecord.slice(-20),
        acts: victim.acts.slice(-20),
      };
      this.recordAct(p, `Detective findings on ${victim.name}: evidence ${p.findings[target] ?? 1}.`);
      this.emit({
        kind: 'detective',
        playerId: p.id,
        targetId: victim.id,
        audience: [p.id],
        text: 'success',
        chance,
        outcome: {
          success: true,
          kind: 'detective',
          amount: -RULES.detectiveFee,
          targetName: victim.name,
          reputationDelta: 0,
          detail: `Evidence ${evidenceStrength(victim.unpaidRent, p.findings[target] ?? 1)} against ${victim.name}.`,
        },
      });
    } else {
      this.recordAct(p, `Detective found nothing on ${victim.name}.`);
      this.emit({
        kind: 'detective',
        playerId: p.id,
        targetId: victim.id,
        audience: [p.id],
        text: 'investigated',
        chance,
        outcome: {
          success: false,
          kind: 'detective',
          amount: -RULES.detectiveFee,
          targetName: victim.name,
          reputationDelta: 0,
          detail: `The detective found nothing usable on ${victim.name}.`,
        },
      });
    }
    this.seq += 1;
    return { ok: true };
  }

  private murder(p: ServerPlayer, target: string): { ok: boolean; reason?: string } {
    const victim = this.players.get(target);
    if (victim) this.cancelTradesFor(victim.id);
    if (!victim || victim.bankrupt || victim.id === p.id) return { ok: false, reason: 'Pick another player.' };
    if (this.now() < p.murderReadyAt) return { ok: false, reason: 'The heat is too high. Wait before another attempt.' };
    p.murderReadyAt = this.now() + RULES.murderCooldownMs;
    p.reputation = applyReputation(p.reputation, -RULES.murderAttemptRep);
    const percent = RULES.murderChance * 100;
    const rollPercent = (this.rollTest() ?? this.rng()) * 100;
    const success = rollPercent < percent;
    const chance: ChanceRoll = {
      label: `Murder attempt on ${victim.name}`,
      percent: Math.round(percent),
      success,
      rollPercent,
      result: success ? 'Target hospitalized' : 'Attempt failed',
    };
    if (success) {
      p.reputation = applyReputation(p.reputation, -RULES.murderSuccessRep);
      this.recordAct(p, `Murdered ${victim.name}.`);
      const repDelta = p.reputation - (p.reputation + RULES.murderSuccessRep);
      for (const [idx, t] of Object.entries(this.tiles)) {
        if (t.ownerId !== victim.id) continue;
        if (t.building) this.buildingCount = Math.max(0, this.buildingCount - 1);
        t.ownerId = null;
        t.building = null;
        t.mortgaged = false;
        t.shares = {};
        t.lockedBy = null;
        void idx;
      }
      victim.cash = 0;
      victim.position = 0;
      victim.inHospital = true;
      victim.hospitalTurns = RULES.hospitalTurns;
      victim.inJail = false;
      victim.jailTurns = 0;
      victim.jailReleaseCost = 0;
      victim.jailCause = null;
      victim.jailOutcome = null;
      victim.jailSold = [];
      victim.pending = null;
      victim.loan = 0;
      victim.holdings = {};
      victim.costBasis = {};
      victim.extraRoll = false;
      this.emit({
        kind: 'murder',
        playerId: p.id,
        targetId: victim.id,
        audience: [p.id, victim.id],
        text: 'success',
        chance,
        outcome: {
          success: true,
          kind: 'murder',
          amount: 0,
          targetName: victim.name,
          reputationDelta: repDelta,
          detail: `${victim.name} is hospitalized and their portfolio is gone.`,
        },
      });
      this.emit({ kind: 'hospital', playerId: victim.id, audience: [p.id, victim.id], text: 'You wake in the hospital. Your portfolio is gone.' });
      this.seq += 1;
      return { ok: true };
    }

    const caught = this.rng() < RULES.murderCaughtChance;
    p.reputation = applyReputation(p.reputation, -(caught ? RULES.murderCaughtRep : 5));
    this.recordAct(p, `Failed murder attempt on ${victim.name}${caught ? ' and was caught' : ''}.`);
    if (caught) {
      const fine = Math.min(p.cash, RULES.murderFine);
      p.cash -= fine;
      this.emit({
        kind: 'murder',
        playerId: p.id,
        targetId: victim.id,
        audience: [p.id],
        text: `caught · fine ${fine}`,
        amount: -fine,
        chance,
        outcome: {
          success: false,
          kind: 'murder',
          amount: -fine,
          targetName: victim.name,
          reputationDelta: -(caught ? RULES.murderCaughtRep : 5),
          detail: `You were caught trying to reach ${victim.name} and fined ${fine}.`,
        },
      });
      this.sendToJail(p, 'a failed murder attempt');
    } else {
      this.emit({
        kind: 'murder',
        playerId: p.id,
        targetId: victim.id,
        audience: [p.id],
        text: 'failed · escaped notice',
        chance,
        outcome: {
          success: false,
          kind: 'murder',
          amount: 0,
          targetName: victim.name,
          reputationDelta: -5,
          detail: `The attempt on ${victim.name} failed, but nobody can tie it to you.`,
        },
      });
    }
    this.seq += 1;
    return { ok: true };
  }

  private recordAct(p: ServerPlayer, text: string): void {
    p.acts.push({ at: this.now(), text });
    if (p.acts.length > 60) p.acts = p.acts.slice(-40);
  }

  // -------------------------------------------------------------------- court

  private sue(p: ServerPlayer, target: string, claim: number): { ok: boolean; reason?: string } {
    const victim = this.players.get(target);
    if (!victim || victim.bankrupt || victim.id === p.id) return { ok: false, reason: 'Pick another player.' };
    const findings = p.findings[target] ?? 0;
    const strength = evidenceStrength(victim.unpaidRent, findings);
    if (strength < 1) return { ok: false, reason: 'You need evidence strength of at least 1. Hire a detective.' };
    const max = maxClaim(strength);
    if (claim < 100 || claim > max) return { ok: false, reason: `Claim must be between 100 and ${max}.` };
    const id = uid('suit');
    const suit: Suit = {
      id,
      plaintiffId: p.id,
      defendantId: victim.id,
      claim: Math.round(claim),
      evidence: strength,
      filedAt: this.now(),
      status: 'pending',
    };
    this.suits.set(id, suit);
    this.lockAssets(p.id, id, true);
    this.lockAssets(victim.id, id, true);
    this.logLine(`${p.name} sues ${victim.name} for ${claim} (evidence ${strength}).`, 'court');
    this.seq += 1;
    return { ok: true };
  }

  private lockAssets(playerId: string, suitId: string, lock: boolean): void {
    for (const t of Object.values(this.tiles)) {
      if (t.ownerId !== playerId) continue;
      if (lock) t.lockedBy = suitId;
      else if (t.lockedBy === suitId) t.lockedBy = null;
    }
  }

  private settle(p: ServerPlayer, suitId: string): { ok: boolean; reason?: string } {
    const suit = this.suits.get(suitId);
    if (!suit || suit.status !== 'pending') return { ok: false, reason: 'No open suit.' };
    if (suit.defendantId !== p.id) return { ok: false, reason: 'Only the defendant can settle.' };
    const amount = Math.round(suit.claim * RULES.settleMultiple);
    if (p.cash < amount) return { ok: false, reason: `Settling costs ${amount}.` };
    p.cash -= amount;
    const plaintiff = this.players.get(suit.plaintiffId);
    if (plaintiff) plaintiff.cash += amount;
    suit.status = 'closed';
    this.lockAssets(suit.plaintiffId, suit.id, false);
    this.lockAssets(suit.defendantId, suit.id, false);
    this.logLine(`${p.name} settles with ${plaintiff?.name ?? 'the plaintiff'} for ${amount}.`, 'court');
    this.emit({ kind: 'verdict', playerId: p.id, amount });
    this.seq += 1;
    return { ok: true };
  }

  private court(p: ServerPlayer, suitId: string): { ok: boolean; reason?: string } {
    const suit = this.suits.get(suitId);
    if (!suit || suit.status !== 'pending') return { ok: false, reason: 'No open suit.' };
    if (suit.plaintiffId !== p.id && suit.defendantId !== p.id) return { ok: false, reason: 'Not your case.' };
    const chanceValue = suitChance(suit.evidence);
    const rollPercent = (this.rollTest() ?? this.rng()) * 100;
    const plaintiffWins = rollPercent < chanceValue * 100;
    const chance: ChanceRoll = {
      label: 'Court verdict',
      percent: Math.round(chanceValue * 100),
      success: plaintiffWins,
      rollPercent,
      result: plaintiffWins ? 'Plaintiff wins' : 'Defendant wins',
    };
    const plaintiff = this.players.get(suit.plaintiffId);
    const defendant = this.players.get(suit.defendantId);
    if (!plaintiff || !defendant) return { ok: false, reason: 'A party has left the board.' };

    if (plaintiffWins) {
      this.charge(defendant, suit.claim + RULES.suitFees, plaintiff.id);
      plaintiff.reputation = applyReputation(plaintiff.reputation, RULES.suitWinRep);
      defendant.reputation = applyReputation(defendant.reputation, -RULES.suitLossRep);
      this.logLine(`Verdict: ${plaintiff.name} wins ${suit.claim + RULES.suitFees} from ${defendant.name}.`, 'court');
    } else {
      this.charge(plaintiff, RULES.suitLoss, defendant.id);
      plaintiff.reputation = applyReputation(plaintiff.reputation, -RULES.suitLossRep);
      this.logLine(`Verdict: ${plaintiff.name} loses and pays ${RULES.suitLoss}. Frivolous suit.`, 'court');
    }
    suit.status = 'closed';
    this.lockAssets(suit.plaintiffId, suit.id, false);
    this.lockAssets(suit.defendantId, suit.id, false);
    this.emit({
      kind: 'verdict',
      playerId: plaintiffWins ? plaintiff.id : defendant.id,
      targetId: plaintiffWins ? defendant.id : plaintiff.id,
      amount: suit.claim,
      chance,
      audience: [plaintiff.id, defendant.id],
    });
    this.seq += 1;
    return { ok: true };
  }

  private payJail(p: ServerPlayer): { ok: boolean; reason?: string } {
    if (!p.inJail) return { ok: false, reason: 'You are not in jail.' };
    const cost = this.jailReleaseCost(p);
    if (p.cash < cost) return { ok: false, reason: `You need ${cost} to restore your properties.` };
    p.cash -= cost;
    for (const t of Object.values(this.tiles)) {
      if (t.ownerId === p.id) t.mortgaged = false;
    }
    p.inJail = false;
    p.jailTurns = 0;
    p.jailReleaseCost = 0;
    this.logLine(`${p.name} pays ${cost} and walks free.`, 'crime');
    this.seq += 1;
    return { ok: true };
  }

  // --------------------------------------------------------------------- tick

  /** Stock prices evolve even while everyone is offline. */
  tick(dtMs: number): void {
    this.tickTimer += dtMs;
    if (this.tickTimer < 5000) return;
    this.tickTimer = 0;
    for (const space of SPACES) {
      if (!space.price) continue;
      const fund = fundamental(space.index, this.tiles);
      const next = clampPrice(
        this.prices[space.index]! * (1 + ((fund - this.prices[space.index]!) / Math.max(1, fund)) * 0.02 * 6 + (this.rng() * 2 - 1) * 0.015 + Math.max(-0.04, Math.min(0.04, (this.volumes[space.index] ?? 0) / 400))),
        fund,
      );
      const before = this.prices[space.index]!;
      this.prices[space.index] = next;
      this.recordPrice(space.index, before, next);
      this.volumes[space.index] = 0;
    }
    this.seq += 1;
    this.dirty = true;
  }

  expirePending(): void {
    const now = this.now();
    this.expireTrades();
    for (const p of this.players.values()) {
      if (p.pending && p.pending.expiresAt < now) {
        if (p.pending.kind === 'rent') {
          const { tile, amount, ownerId } = p.pending;
          p.pending = null;
          this.payRent(p, tile, amount, ownerId ?? null, false);
          this.finishTurn(p);
        } else {
          p.pending = null;
          this.finishTurn(p);
        }
        this.seq += 1;
      }
    }
  }

  private botTakeTurn(p: ServerPlayer, now: number): void {
    if (p.pending) {
      if (p.pending.kind === 'buy') {
        const price = p.pending.amount;
        if (p.cash > price * 1.8) this.intent(p.id, { t: 'buy', tile: p.pending.tile, key: `bot-buy-${p.pending.tile}-${now}` });
        else this.intent(p.id, { t: 'decline', tile: p.pending.tile, key: `bot-dec-${now}` });
      } else {
        this.intent(p.id, { t: 'payRent', tile: p.pending.tile, key: `bot-rent-${now}` });
      }
      return;
    }
    if (p.inJail && p.cash > this.jailReleaseCost(p) * 1.4) {
      this.intent(p.id, { t: 'jailPay', key: `bot-jail-${now}` });
      return;
    }
    // Modest AI: build when a full group is held, then roll next tick.
    for (const space of SPACES) {
      const state = this.tiles[space.index]!;
      if (state.ownerId !== p.id || state.building || !space.buildCost) continue;
      if (!ownsGroup(space.group, p.id, this.tiles)) continue;
      if (p.cash > buildingCost(space, 'house') * 2.4) {
        this.intent(p.id, { t: 'build', tile: space.index, type: 'house', key: `bot-build-${space.index}-${now}` });
        return;
      }
    }
    this.intent(p.id, { t: 'roll', key: `bot-roll-${now}` });
  }

  runBots(): void {
    const now = this.now();
    if (this.mode === 'solo') {
      this.decideBotTrades(now);
      const active = this.activePlayerId ? this.players.get(this.activePlayerId) : null;
      if (!active || !active.isBot || active.bankrupt) return;
      if (now - this.lastBotAt < 900 || now - this.turnStartedAt < 500) return;
      this.lastBotAt = now;
      this.botTakeTurn(active, now);
      return;
    }
    for (const p of this.players.values()) {
      if (!p.isBot || p.bankrupt) continue;
      if (now - p.lastRollAt < 2600) continue;
      this.botTakeTurn(p, now);
    }
  }

  /** Test-only setup used by the loopback scenario endpoint. */
  testSetup(session: string, setup: TestSetup): { ok: boolean; reason?: string; playerId?: string } {
    const players = [...this.players.values()];
    const actor = players.find((p) => p.session === session);
    if (!actor) return { ok: false, reason: 'Unknown session.' };
    const target = setup.targetSession ? players.find((p) => p.session === setup.targetSession) : undefined;
    const tile = setup.tile ?? 1;
    if (setup.roll !== undefined) this.testRoll = setup.roll;

    switch (setup.kind) {
      case 'cash':
        if (setup.cash !== undefined) actor.cash = setup.cash;
        if (setup.reputation !== undefined) actor.reputation = setup.reputation;
        break;
      case 'rent': {
        const owner = setup.ownerSession ? players.find((p) => p.session === setup.ownerSession) : players.find((p) => p.id !== actor.id);
        if (!owner) return { ok: false, reason: 'A second player is needed as owner.' };
        if (!spaceAt(tile).price) return { ok: false, reason: 'That space cannot be owned.' };
        const state = this.tiles[tile]!;
        state.ownerId = owner.id;
        state.mortgaged = false;
        state.lockedBy = null;
        state.building = setup.building ?? null;
        if (setup.cash !== undefined) actor.cash = setup.cash;
        actor.position = tile;
        actor.pending = {
          kind: 'rent',
          tile,
          amount: rentFor(tile, this.tiles, 7),
          ownerId: owner.id,
          expiresAt: this.now() + 120_000,
        };
        break;
      }
      case 'jail': {
        if (!spaceAt(tile).price) return { ok: false, reason: 'That space cannot be owned.' };
        const state = this.tiles[tile]!;
        state.ownerId = actor.id;
        state.mortgaged = false;
        state.lockedBy = null;
        state.building = 'house';
        actor.cash = setup.cash ?? 5000;
        actor.pending = null;
        actor.unpaidRent += setup.unpaid ?? 300;
        actor.jailRecord.push({ tile, amount: setup.unpaid ?? 300, at: this.now() });
        this.sendToJail(actor, 'the test scenario');
        actor.cash = setup.cash ?? 5000;
        actor.jailReleaseCost = this.jailReleaseCost(actor);
        break;
      }
      case 'evidence':
        if (!target) return { ok: false, reason: 'A target is needed.' };
        actor.cash = setup.cash ?? 12_000;
        actor.findings[target.id] = setup.findings ?? 1;
        target.unpaidRent = setup.unpaid ?? 300;
        target.jailRecord = [{ tile, amount: target.unpaidRent, at: this.now() }];
        break;
      case 'suit': {
        if (!target) return { ok: false, reason: 'A defendant is needed.' };
        actor.findings[target.id] = setup.findings ?? 2;
        target.unpaidRent = setup.unpaid ?? 300;
        if (setup.cash !== undefined) actor.cash = setup.cash;
        const result = this.sue(actor, target.id, setup.claim ?? 500);
        if (!result.ok) return result;
        break;
      }
      case 'build': {
        const space = spaceAt(tile);
        if (!space.group) return { ok: false, reason: 'That space has no colour group.' };
        for (const member of groupMembers(space.group)) {
          const state = this.tiles[member.index]!;
          state.ownerId = actor.id;
          state.mortgaged = false;
          state.lockedBy = null;
          state.building = null;
        }
        actor.cash = setup.cash ?? 5000;
        break;
      }
      case 'theft':
        actor.cash = setup.cash ?? 1500;
        actor.reputation = setup.reputation ?? 50;
        actor.lastTheftAt = 0;
        break;
      case 'offer': {
        if (!spaceAt(tile).price) return { ok: false, reason: 'That space cannot be bought.' };
        actor.position = tile;
        actor.pending = { kind: 'buy', tile, amount: spaceAt(tile).price, expiresAt: this.now() + 120_000 };
        break;
      }
      case 'card':
        actor.pending = null;
        this.drawCard(actor, setup.deck ?? 'chance');
        break;
      case 'endgame':
        this.gameOver = { winnerId: actor.id, at: this.now() };
        break;
    }
    this.buildingCount = groupBuildingCount(this.tiles);
    this.seq += 1;
    this.dirty = true;
    return { ok: true, playerId: actor.id };
  }

  private rollTest(): number | null {
    if (this.testRoll === null) return null;
    const value = this.testRoll;
    this.testRoll = null;
    return value;
  }

  logLine(text: string, kind: LogEntry['kind']): void {
    this.logSeq += 1;
    this.log.push({ id: this.logSeq, at: this.now(), text, kind });
    if (this.log.length > 400) this.log = this.log.slice(-200);
  }

  private recordPrice(tile: number, before: number, after: number): void {
    if (Math.abs(after - before) < 0.005) return;
    this.marketSeq += 1;
    const percent = before > 0 ? ((after - before) / before) * 100 : 0;
    this.marketFeed.push({
      id: this.marketSeq,
      at: this.now(),
      tile,
      name: spaceAt(tile).name,
      oldPrice: before,
      newPrice: after,
      percent: Math.round(percent * 100) / 100,
    });
    if (this.marketFeed.length > 80) this.marketFeed = this.marketFeed.slice(-60);
  }

  private emit(event: GameEvent): void {
    this.onEvent({ ...event, at: this.now() });
  }

  snapshot(): WorldSnapshot {
    return {
      seq: this.seq,
      players: [...this.players.values()].map((p) => ({ ...p, intents: new Map() })),
      tiles: this.tiles,
      prices: this.prices,
      log: this.log,
      suitSeq: this.suitSeq,
      logSeq: this.logSeq,
      activePlayerId: this.activePlayerId,
      turnNumber: this.turnNumber,
      trades: [...this.trades.values()],
      marketFeed: this.marketFeed,
      marketSeq: this.marketSeq,
    };
  }

  restore(snap: WorldSnapshot): void {
    this.seq = snap.seq ?? 0;
    this.tiles = snap.tiles;
    this.prices = snap.prices;
    this.log = snap.log ?? [];
    this.logSeq = snap.logSeq ?? this.log.length;
    this.suitSeq = snap.suitSeq ?? 0;
    this.activePlayerId = snap.activePlayerId ?? null;
    this.turnNumber = snap.turnNumber ?? 0;
    this.trades = new Map((snap.trades ?? []).map((t) => [t.id, t]));
    this.marketFeed = snap.marketFeed ?? [];
    this.marketSeq = snap.marketSeq ?? 0;
    this.buildingCount = groupBuildingCount(this.tiles);
    for (const raw of snap.players) {
      const p = raw as ServerPlayer;
      this.players.set(p.id, {
        ...p,
        acts: p.acts ?? [],
        costBasis: p.costBasis ?? {},
        realizedPnl: p.realizedPnl ?? 0,
        inHospital: p.inHospital ?? false,
        hospitalTurns: p.hospitalTurns ?? 0,
        jailCause: p.jailCause ?? null,
        jailOutcome: p.jailOutcome ?? null,
        jailSold: p.jailSold ?? [],
        murderReadyAt: p.murderReadyAt ?? 0,
        extraRoll: false,
        intents: new Map(p.intents ?? []),
        pending: null,
      });
    }
  }
}

export function groupSynergyText(tile: number, tiles: Record<number, TileState>): string {
  const space = spaceAt(tile);
  const state = tiles[tile];
  if (!space.group || !state?.building) return '';
  const members = groupMembers(space.group);
  const same = members.filter((s) => tiles[s.index]?.building === state.building).length;
  if (same === members.length) return 'Group synergy active';
  return '';
}
