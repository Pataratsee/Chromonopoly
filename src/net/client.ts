import type { GameEvent, GameMode, Intent, PrivateState, PublicState, ServerMessage } from '../game/types';

type StateHandler = (state: PublicState) => void;
type PrivateHandler = (state: PrivateState) => void;
type EventHandler = (event: GameEvent) => void;
type StatusHandler = (status: 'connecting' | 'online' | 'offline', reason?: string) => void;

const SESSION_KEY = 'chromonopoly.session';
const NAME_KEY = 'chromonopoly.name';
const TOKEN_KEY = 'chromonopoly.token';
const sessionKey = (mode: GameMode): string => `${SESSION_KEY}.${mode}`;

export class NetClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private attempts = 0;
  private queue: Intent[] = [];
  playerId: string | null = null;
  mode: GameMode = 'multi';
  lastSeq = -1;
  onState: StateHandler = () => undefined;
  onPrivate: PrivateHandler = () => undefined;
  onEvent: EventHandler = () => undefined;
  onStatus: StatusHandler = () => undefined;
  onReject: (reason: string) => void = () => undefined;

  connect(name?: string, tokenId?: string, mode: GameMode = this.mode): void {
    this.mode = mode;
    const storedName = name ?? localStorage.getItem(NAME_KEY) ?? '';
    const storedToken = tokenId ?? localStorage.getItem(TOKEN_KEY) ?? 'cat';
    this.onStatus('connecting');
    const ws = new WebSocket(this.socketUrl());
    this.ws = ws;

    ws.onopen = () => {
      this.attempts = 0;
      this.onStatus('online');
      ws.send(
        JSON.stringify({
          type: 'hello',
          name: storedName || 'Tycoon',
          tokenId: storedToken,
          mode,
          session: localStorage.getItem(sessionKey(mode)) ?? localStorage.getItem(SESSION_KEY) ?? undefined,
        }),
      );
      for (const intent of this.queue.splice(0)) ws.send(JSON.stringify({ type: 'intent', intent }));
    };

    ws.onmessage = (raw) => {
      let msg: ServerMessage & { seqq?: number };
      try {
        msg = JSON.parse(String(raw.data));
      } catch {
        return;
      }
      if (msg.type === 'welcome') {
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
      } else if (msg.type === 'rejected') {
        this.onReject(msg.reason ?? 'Action refused');
      }
    };

    ws.onclose = () => {
      this.onStatus('offline');
      this.scheduleReconnect(storedName, storedToken, mode);
    };
    ws.onerror = () => ws.close();
  }

  /**
   * A deployed static frontend points at the separately hosted game server.
   * The value is an HTTP(S) origin; it is converted to the matching WS scheme.
   */
  private socketUrl(): string {
    const configured = import.meta.env.VITE_GAME_SERVER_URL?.trim();
    if (configured) {
      const url = new URL(configured);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      if (url.pathname === '/' || url.pathname === '') url.pathname = '/ws';
      return url.toString();
    }
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${protocol}://${this.gameHost()}/ws`;
  }

  /**
   * Node serves the client and WebSocket together; Vite proxies them. A plain
   * static server on 8000 (or the build under /dist/) cannot proxy, so point
   * the socket at the game server's default port.
   */
  private gameHost(): string {
    const staticPreview = location.port === '8000' || location.pathname.startsWith('/dist/');
    return staticPreview ? `${location.hostname}:8787` : location.host;
  }

  private scheduleReconnect(name: string, tokenId: string, mode: GameMode): void {
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

  setIdentity(name: string, tokenId: string): void {
    localStorage.setItem(NAME_KEY, name);
    localStorage.setItem(TOKEN_KEY, tokenId);
  }

  close(): void {
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.ws?.close();
  }
}

/** Idempotency key per user action; a double fire sends the same key. */
export function intentKey(action: string): string {
  return `${action}:${crypto.randomUUID()}`;
}
