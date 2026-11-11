import type { Candle, GameEvent, GameMode, Intent, PrivateState, PublicState, ServerMessage } from '../game/types';
import { normalizeUsername } from '../game/username';
import { socketUrl } from './endpoint';
import { applyStatePatch, type StatePatch } from '../../server/delta';

type StateHandler = (state: PublicState) => void;
type PrivateHandler = (state: PrivateState) => void;
type EventHandler = (event: GameEvent) => void;
type StatusHandler = (status: 'connecting' | 'online' | 'offline', reason?: string) => void;

const SESSION_KEY = 'chromonopoly.session';
const NAME_KEY = 'chromonopoly.name';
const TOKEN_KEY = 'chromonopoly.token';
const SOLO_KEY = 'chromonopoly.solo.key';
const PLAYER_TOKEN_PREFIX = 'chromonopoly.player-token.';
const MAX_QUEUE = 64;
const HEARTBEAT_MS = 10_000;
const DEAD_AFTER_MS = 35_000;
const sessionKey = (mode: GameMode): string => `${SESSION_KEY}.${mode}`;

/** Stable browser key for the server-side single-player save. */
export function soloKey(): string {
  let key = localStorage.getItem(SOLO_KEY);
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem(SOLO_KEY, key);
  }
  return key;
}

/** 256-bit reclaim secret, stored per username. It is never rendered or broadcast. */
export function playerTokenFor(rawName: string): string {
  const key = `${PLAYER_TOKEN_PREFIX}${normalizeUsername(rawName).toLowerCase()}`;
  const saved = localStorage.getItem(key);
  if (saved) return saved;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  localStorage.setItem(key, token);
  return token;
}

export class NetClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private attempts = 0;
  private stopped = false;
  private freshSolo = false;
  private queue: Intent[] = [];
  private currentState: PublicState | null = null;
  private lastMessageAt = 0;
  playerId: string | null = null;
  mode: GameMode = 'multi';
  lastSeq = -1;
  onState: StateHandler = () => undefined;
  onPrivate: PrivateHandler = () => undefined;
  onEvent: EventHandler = () => undefined;
  onStatus: StatusHandler = () => undefined;
  onReject: (reason: string) => void = () => undefined;
  onMarket: (tile: number, candles: Candle[]) => void = () => undefined;
  latency = 0;
  onJoinRejected: (reason: string) => void = () => undefined;

  connect(name?: string, tokenId?: string, mode: GameMode = this.mode): void {
    this.stopped = false;
    this.detach();
    this.mode = mode;
    this.lastSeq = -1;
    this.currentState = null;
    const storedName = normalizeUsername(name ?? localStorage.getItem(NAME_KEY) ?? '');
    const storedToken = tokenId ?? localStorage.getItem(TOKEN_KEY) ?? 'cat';
    this.onStatus('connecting');
    const ws = new WebSocket(socketUrl());
    this.ws = ws;

    ws.onopen = () => {
      this.lastMessageAt = Date.now();
      ws.send(
        JSON.stringify({
          type: 'hello',
          name: storedName,
          tokenId: storedToken,
          mode,
          session: localStorage.getItem(sessionKey(mode)) ?? localStorage.getItem(SESSION_KEY) ?? undefined,
          playerToken: mode === 'multi' ? playerTokenFor(storedName) : undefined,
          soloKey: mode === 'solo' ? soloKey() : undefined,
          fresh: mode === 'solo' ? this.freshSolo : undefined,
        }),
      );
      this.freshSolo = false;
      for (const intent of this.queue.splice(0)) ws.send(JSON.stringify({ type: 'intent', intent }));
      this.startHeartbeat(ws);
    };

    ws.onmessage = (raw) => {
      this.lastMessageAt = Date.now();
      let msg: ServerMessage;
      try {
        msg = JSON.parse(String(raw.data)) as ServerMessage;
      } catch {
        return;
      }
      if (msg.type === 'welcome') {
        this.attempts = 0;
        this.onStatus('online');
        this.playerId = msg.playerId ?? null;
        if (msg.session) {
          localStorage.setItem(sessionKey(mode), msg.session);
          localStorage.setItem(SESSION_KEY, msg.session);
        }
      } else if (msg.type === 'state' || msg.type === 'resync') {
        if (msg.state) {
          if (this.lastSeq >= 0 && msg.state.seq < this.lastSeq) return;
          this.currentState = msg.state;
          this.lastSeq = msg.state.seq;
          this.onState(msg.state);
        }
        if (msg.private) this.onPrivate(msg.private);
      } else if (msg.type === 'delta') {
        if (msg.patch && Number.isInteger(msg.seq) && Number.isInteger(msg.baseSeq)) {
          if (!this.currentState || msg.baseSeq !== this.lastSeq) {
            this.resync();
            return;
          }
          const next = applyStatePatch(this.currentState, msg.patch as StatePatch);
          if (next.seq !== msg.seq) {
            this.resync();
            return;
          }
          this.currentState = next;
          this.lastSeq = next.seq;
          this.onState(next);
        }
      } else if (msg.type === 'pong') {
        if (typeof msg.t === 'number') {
          const sample = Math.max(0, Date.now() - msg.t);
          this.latency = this.latency ? Math.round(this.latency * 0.7 + sample * 0.3) : sample;
        }
      } else if (msg.type === 'private' && msg.private) {
        this.onPrivate(msg.private);
      } else if (msg.type === 'event' && msg.event) {
        this.onEvent(msg.event);
      } else if (msg.type === 'market' && Number.isInteger(msg.tile) && msg.candles) {
        this.onMarket(msg.tile!, msg.candles);
      } else if (msg.type === 'rejected') {
        this.onReject(msg.reason ?? 'Action refused');
      }
    };

    ws.onclose = (event) => {
      this.stopHeartbeat();
      this.currentState = null;
      this.lastSeq = -1;
      if (this.stopped) return;
      if (event.code === 4003) {
        this.stopped = true;
        this.onStatus('offline', event.reason || 'name unavailable');
        this.onJoinRejected(event.reason || 'That name is already taken.');
        return;
      }
      this.onStatus('offline');
      this.scheduleReconnect(storedName, storedToken, mode);
    };
    ws.onerror = () => ws.close();
  }

  private startHeartbeat(ws: WebSocket): void {
    this.stopHeartbeat();
    this.lastMessageAt = Date.now();
    this.heartbeatTimer = window.setInterval(() => {
      if (this.stopped || ws.readyState !== WebSocket.OPEN) return;
      if (Date.now() - this.lastMessageAt > DEAD_AFTER_MS) {
        ws.close(4000, 'heartbeat timeout');
        return;
      }
      ws.send(JSON.stringify({ type: 'ping', t: Date.now() }));
    }, HEARTBEAT_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) window.clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private scheduleReconnect(name: string, tokenId: string, mode: GameMode): void {
    if (this.stopped) return;
    if (this.reconnectTimer) return;
    this.attempts += 1;
    // Exponential backoff with ±20% jitter avoids a reconnect stampede when a
    // shared table or server restarts.
    const base = Math.min(8000, 400 * 2 ** Math.min(5, this.attempts));
    const delay = Math.round(base * (0.8 + Math.random() * 0.4));
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(name, tokenId, mode);
    }, delay);
  }

  /** Leaves the current board and starts again with a fresh session. */
  restart(name: string, tokenId: string, mode: GameMode): void {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(sessionKey(mode));
    this.freshSolo = mode === 'solo';
    this.lastSeq = -1;
    this.currentState = null;
    this.playerId = null;
    this.connect(name, tokenId, mode);
  }

  send(intent: Intent): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'intent', intent }));
    } else {
      // Every intent already has an idempotency key, so replaying the bounded
      // queue after reconnect cannot double-charge a purchase.
      if (this.queue.length >= MAX_QUEUE) this.queue.shift();
      this.queue.push(intent);
    }
  }

  resync(): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: 'resync' }));
  }

  requestMarket(tile: number): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: 'market', tile }));
  }

  setIdentity(name: string, tokenId: string): void {
    localStorage.setItem(NAME_KEY, normalizeUsername(name));
    localStorage.setItem(TOKEN_KEY, tokenId);
  }

  close(): void {
    this.stopped = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.detach();
  }

  private detach(): void {
    this.stopHeartbeat();
    const ws = this.ws;
    this.ws = null;
    if (!ws) return;
    ws.onopen = null;
    ws.onmessage = null;
    ws.onclose = null;
    ws.onerror = null;
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close();
  }
}

/** Idempotency key per user action; a double fire sends the same key. */
export function intentKey(action: string): string {
  return `${action}:${crypto.randomUUID()}`;
}
