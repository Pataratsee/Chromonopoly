import type { Candle, GameEvent, GameMode, Intent, PrivateState, PublicState, ServerMessage } from '../game/types';
import { normalizeUsername } from '../game/username';
import { socketUrl } from './endpoint';

type StateHandler = (state: PublicState) => void;
type PrivateHandler = (state: PrivateState) => void;
type EventHandler = (event: GameEvent) => void;
type StatusHandler = (status: 'connecting' | 'online' | 'offline', reason?: string) => void;

const SESSION_KEY = 'chromonopoly.session';
const NAME_KEY = 'chromonopoly.name';
const TOKEN_KEY = 'chromonopoly.token';
const SOLO_KEY = 'chromonopoly.solo.key';
const PLAYER_TOKEN_PREFIX = 'chromonopoly.player-token.';
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
  private attempts = 0;
  private stopped = false;
  private freshSolo = false;
  private queue: Intent[] = [];
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
    const storedName = normalizeUsername(name ?? localStorage.getItem(NAME_KEY) ?? '');
    const storedToken = tokenId ?? localStorage.getItem(TOKEN_KEY) ?? 'cat';
    this.onStatus('connecting');
    const ws = new WebSocket(socketUrl());
    this.ws = ws;

    ws.onopen = () => {
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
    };

    ws.onmessage = (raw) => {
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
          if (this.lastSeq >= 0 && msg.state.seq > this.lastSeq + 3) {
            ws.send(JSON.stringify({ type: 'resync' }));
          }
          this.lastSeq = msg.state.seq;
          this.onState(msg.state);
        }
        if (msg.private) this.onPrivate(msg.private);
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

  private scheduleReconnect(name: string, tokenId: string, mode: GameMode): void {
    if (this.stopped) return;
    if (this.reconnectTimer) return;
    this.attempts += 1;
    const delay = Math.min(8000, 500 * 2 ** Math.min(4, this.attempts));
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
    this.playerId = null;
    this.connect(name, tokenId, mode);
  }

  send(intent: Intent): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'intent', intent }));
    } else {
      this.queue.push(intent);
    }
  }

  resync(): void {
    this.ws?.send(JSON.stringify({ type: 'resync' }));
  }

  requestMarket(tile: number): void {
    this.ws?.send(JSON.stringify({ type: 'market', tile }));
  }

  setIdentity(name: string, tokenId: string): void {
    localStorage.setItem(NAME_KEY, normalizeUsername(name));
    localStorage.setItem(TOKEN_KEY, tokenId);
  }

  close(): void {
    this.stopped = true;
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.detach();
  }

  private detach(): void {
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
