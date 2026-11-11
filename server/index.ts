import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { World, type TestSetup } from './world.ts';
import { Store } from './db.ts';
import type { GameEvent, GameMode, Intent, PublicState, ServerMessage } from '../src/game/types.ts';
import { diffState } from './delta.ts';
import { normalizeUsername, usernameIssue } from '../src/game/username.ts';

const PORT = Number(process.env.CHROMONOPOLY_PORT ?? process.env.PORT ?? 8787) || 8787;
const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const BUILD = process.env.RENDER_GIT_COMMIT ?? process.env.GIT_COMMIT ?? 'dev';
const PROTOCOL = 4;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.wasm': 'application/wasm',
  '.ktx2': 'image/ktx2',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.m4a': 'audio/mp4',
};

const store = new Store();
const compressionCache = new Map<string, Buffer>();
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.ttf', '.gltf']);

interface Client {
  ws: WebSocket;
  playerId: string;
  world: World;
  mode: GameMode;
  /** Sequence the client has actually been sent, used as the delta base. */
  lastSeq: number;
}

interface BroadcastFrame {
  seq: number;
  previousSeq: number | null;
  fullJson: string;
  deltaJson: string | null;
  state: PublicState;
}

const clients = new Map<WebSocket, Client>();
const events: GameEvent[] = [];
const soloWorlds = new Map<string, { world: World; touched: number; saved?: number }>();
const frames = new Map<World, BroadcastFrame>();
const SOFT_BUFFER = 256 * 1024;
const HARD_BUFFER = 2 * 1024 * 1024;
const startedAt = Date.now();
const metrics = {
  intents: 0,
  rejected: 0,
  errors: 0,
  dropped: 0,
  bytesOut: 0,
  deltaFrames: 0,
  fullFrames: 0,
  actionMs: [] as number[],
  tickMs: [] as number[],
  lastSaveAt: 0,
};

function clientsIn(world: World): Client[] {
  return [...clients.values()].filter((c) => c.world === world);
}

function record(list: number[], value: number): void {
  list.push(value);
  if (list.length > 2000) list.splice(0, list.length - 2000);
}

function percentile(list: number[], fraction: number): number {
  if (!list.length) return 0;
  const sorted = [...list].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]!;
}

function safeSendRaw(ws: WebSocket, payload: string): boolean {
  if (ws.readyState !== WebSocket.OPEN) return false;
  try {
    ws.send(payload);
    metrics.bytesOut += Buffer.byteLength(payload);
    return true;
  } catch (error) {
    metrics.errors += 1;
    console.error(JSON.stringify({ at: new Date().toISOString(), level: 'error', event: 'send', error: error instanceof Error ? error.message : String(error) }));
    return false;
  }
}

function send(ws: WebSocket, message: ServerMessage): void {
  safeSendRaw(ws, JSON.stringify(message));
}

function broadcastWorld(world: World, message: ServerMessage): void {
  const payload = JSON.stringify(message);
  for (const client of clientsIn(world)) {
    if (message.type === 'event' && message.event?.audience?.length) {
      if (!message.event.audience.includes(client.playerId)) continue;
    }
    if (client.ws.bufferedAmount > HARD_BUFFER) {
      metrics.dropped += 1;
      client.ws.terminate();
      continue;
    }
    safeSendRaw(client.ws, payload);
  }
}

/**
 * One deep diff per world per tick, not per client. Clients that are in step
 * receive the compact delta; a client that missed a frame or is under socket
 * backpressure receives a full snapshot and starts a fresh delta chain.
 */
function broadcastBoard(world: World): void {
  const state = world.publicState();
  const previous = frames.get(world);
  if (previous?.seq === state.seq) return;
  const patch = previous ? diffState(previous.state, state) : null;
  const fullJson = JSON.stringify({ type: 'state', state });
  let deltaJson = patch ? JSON.stringify({ type: 'delta', seq: state.seq, baseSeq: previous!.seq, patch }) : null;
  if (deltaJson && deltaJson.length >= fullJson.length * 0.92) deltaJson = null;
  const frame: BroadcastFrame = {
    seq: state.seq,
    previousSeq: previous?.seq ?? null,
    fullJson,
    deltaJson,
    state: structuredClone(state),
  };
  frames.set(world, frame);

  for (const client of clientsIn(world)) {
    if (client.ws.readyState !== WebSocket.OPEN) continue;
    if (client.ws.bufferedAmount > HARD_BUFFER) {
      metrics.dropped += 1;
      client.ws.terminate();
      continue;
    }
    const canDelta = Boolean(
      deltaJson
      && client.lastSeq === frame.previousSeq
      && client.ws.bufferedAmount < SOFT_BUFFER,
    );
    if (canDelta) {
      if (safeSendRaw(client.ws, deltaJson!)) {
        client.lastSeq = state.seq;
        metrics.deltaFrames += 1;
      }
    } else if (safeSendRaw(client.ws, fullJson)) {
      client.lastSeq = state.seq;
      metrics.fullFrames += 1;
      if (client.ws.bufferedAmount > SOFT_BUFFER) metrics.dropped += 1;
    }
  }
}

function snapshotFor(ws: WebSocket, world: World, playerId: string): number {
  const state = world.publicState();
  send(ws, { type: 'state', state });
  send(ws, { type: 'private', private: world.privateState(playerId) });
  return state.seq;
}

function logMetrics(event: string): void {
  console.log(JSON.stringify({
    at: new Date().toISOString(),
    level: 'info',
    event,
    uptime: Math.round(process.uptime()),
    players: publicWorld.players.size,
    online: [...publicWorld.players.values()].filter((p) => p.online).length,
    sockets: clients.size,
    seq: publicWorld.seq,
    intents: metrics.intents,
    rejected: metrics.rejected,
    errors: metrics.errors,
    dropped: metrics.dropped,
    p95ActionMs: Number(percentile(metrics.actionMs, 0.95).toFixed(2)),
    p95TickMs: Number(percentile(metrics.tickMs, 0.95).toFixed(2)),
    bytesOut: metrics.bytesOut,
    deltaFrames: metrics.deltaFrames,
    fullFrames: metrics.fullFrames,
  }));
}

function newWorld(mode: GameMode): World {
  let self!: World;
  self = new World({
    mode,
    onEvent: (event) => {
      events.push(event);
      if (events.length > 160) events.shift();
      broadcastWorld(self, { type: 'event', event });
    },
  });
  return self;
}

let publicWorld = newWorld('multi');
const savedWorld = store.loadWorld();
if (savedWorld) {
  publicWorld.restore(savedWorld);
  publicWorld.purgeBots();
  console.log(`restored shared board with ${publicWorld.players.size} names, seq ${publicWorld.seq}`);
}

const BOT_TOKENS = ['dog', 'taxi', 'penguin', 'chest', 'locomotive', 'panda'];

function fillSoloBots(world: World): void {
  while ([...world.players.values()].filter((p) => p.isBot).length < 3) world.addBot(BOT_TOKENS);
}

function cors(req: IncomingMessage, res: ServerResponse): void {
  res.setHeader('access-control-allow-origin', req.headers.origin ?? '*');
  res.setHeader('vary', 'Origin');
  res.setHeader('access-control-allow-headers', 'content-type');
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  res.setHeader('access-control-max-age', '86400');
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  cors(req, res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }

  if (url.pathname === '/api/health' || url.pathname === '/health') {
    json(res, 200, {
      ok: true,
      players: publicWorld.players.size,
      online: [...publicWorld.players.values()].filter((p) => p.online).length,
      seq: publicWorld.seq,
      soloTables: soloWorlds.size,
      uptime: process.uptime(),
      startedAt,
      version: BUILD,
      protocol: PROTOCOL,
      sockets: clients.size,
      p95ActionMs: Number(percentile(metrics.actionMs, 0.95).toFixed(2)),
      p95TickMs: Number(percentile(metrics.tickMs, 0.95).toFixed(2)),
      droppedUpdates: metrics.dropped,
      deltaFrames: metrics.deltaFrames,
      fullFrames: metrics.fullFrames,
      bytesOut: metrics.bytesOut,
      lastSaveAt: metrics.lastSaveAt,
    });
    return;
  }

  if (url.pathname === '/api/solo' && req.method === 'GET') {
    const key = url.searchParams.get('key') ?? '';
    if (!key) {
      json(res, 400, { error: 'Missing save key.' });
      return;
    }
    json(res, 200, store.soloMeta(key));
    return;
  }

  if (url.pathname === '/api/test/reset') {
    const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '');
    if (process.env.CHROMONOPOLY_TEST !== '1' || !loopback || req.method !== 'POST') {
      res.writeHead(404).end();
      return;
    }
    for (const ws of clients.keys()) ws.close(1001, 'test reset');
    clients.clear();
    soloWorlds.clear();
    events.length = 0;
    publicWorld = newWorld('multi');
    json(res, 200, { ok: true });
    return;
  }

  if (url.pathname === '/api/test/scenario') {
    const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '');
    if (process.env.CHROMONOPOLY_TEST !== '1' || !loopback || req.method !== 'POST') {
      res.writeHead(404).end();
      return;
    }
    let raw = '';
    for await (const chunk of req) raw += chunk;
    try {
      const parsed = JSON.parse(raw) as { session?: string; setup?: TestSetup; mode?: GameMode };
      if (!parsed.session || !parsed.setup) throw new Error('session and setup are required');
      const targetWorld = parsed.mode === 'solo'
        ? [...soloWorlds.values()].map((entry) => entry.world).find((world) =>
            [...world.players.values()].some((player) => player.session === parsed.session),
          )
        : publicWorld;
      if (!targetWorld) throw new Error('no world for that session');
      const result = targetWorld.testSetup(parsed.session, parsed.setup);
      json(res, result.ok ? 200 : 400, result);
    } catch (err) {
      json(res, 400, { ok: false, reason: err instanceof Error ? err.message : 'bad request' });
    }
    return;
  }

  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    json(res, 404, { error: 'Unknown API route.' });
    return;
  }
  if (url.pathname === '/ws') {
    res.writeHead(426, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('WebSocket upgrade required');
    return;
  }

  let filePath = path.join(DIST, decodeURIComponent(url.pathname));
  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = path.join(filePath, 'index.html');
  } catch {
    filePath = path.join(DIST, 'index.html');
  }
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const headers: Record<string, string | number> = {
      'content-type': MIME[ext] ?? 'application/octet-stream',
      'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=604800',
      'x-content-type-options': 'nosniff',
      vary: 'Accept-Encoding',
    };
    let body: Buffer = data;
    if (COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
      body = compressionCache.get(filePath) ?? gzipSync(data, { level: 9 });
      compressionCache.set(filePath, body);
      headers['content-encoding'] = 'gzip';
    }
    headers['content-length'] = body.length;
    res.writeHead(200, headers);
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
});

const wss = new WebSocketServer({
  server,
  path: '/ws',
  perMessageDeflate: { threshold: 512, zlibDeflateOptions: { level: 3 } },
  maxPayload: 64 * 1024,
  clientTracking: true,
});

wss.on('connection', (ws) => {
  let client: Client | null = null;
  (ws as WebSocket & { _socket?: { setNoDelay(value: boolean): void } })._socket?.setNoDelay(true);
  let windowStartedAt = Date.now();
  let messagesInWindow = 0;

  ws.on('error', (error) => {
    metrics.errors += 1;
    console.error(JSON.stringify({ at: new Date().toISOString(), level: 'error', event: 'socket', error: error.message }));
  });

  ws.on('message', (raw) => {
    const now = Date.now();
    if (now - windowStartedAt >= 1000) {
      windowStartedAt = now;
      messagesInWindow = 0;
    }
    messagesInWindow += 1;
    if (messagesInWindow > 60) {
      metrics.rejected += 1;
      send(ws, { type: 'rejected', reason: 'Too many messages. Slow down.' });
      ws.close(1008, 'rate limit');
      return;
    }
    let msg: {
      type?: string;
      intent?: Intent;
      t?: number;
      name?: string;
      tokenId?: string;
      session?: string;
      playerToken?: string;
      mode?: GameMode;
      soloKey?: string;
      fresh?: boolean;
      color?: string;
      tile?: number;
    };
    try {
      msg = JSON.parse(String(raw));
    } catch {
      send(ws, { type: 'rejected', reason: 'Malformed message.' });
      return;
    }

    if (msg.type === 'hello') {
      const mode: GameMode = msg.mode === 'solo' ? 'solo' : 'multi';
      const name = normalizeUsername(String(msg.name ?? ''));
      const issue = usernameIssue(name);
      if (issue) {
        send(ws, { type: 'rejected', reason: issue });
        ws.close(4003, issue);
        return;
      }
      const tokenId = String(msg.tokenId ?? 'cat');
      const color = typeof msg.color === 'string' ? msg.color : undefined;
      const soloSave = mode === 'solo' ? String(msg.soloKey ?? '') : '';
      let world = publicWorld;
      let known: { world: World; touched: number; saved?: number } | undefined;
      if (mode === 'solo') {
        if (soloSave && msg.fresh) {
          store.deleteSolo(soloSave);
          soloWorlds.delete(soloSave);
        }
        known = soloSave ? soloWorlds.get(soloSave) : undefined;
        if (known) {
          world = known.world;
          known.touched = Date.now();
        } else {
          world = newWorld('solo');
          const saved = soloSave ? store.loadSolo(soloSave) : null;
          if (saved) world.restore(saved);
        }
      }
      const seated = mode === 'solo' ? [...world.players.values()].find((p) => !p.isBot) : undefined;
      let joined: ReturnType<World['join']>;
      try {
        joined = world.join(
          name,
          tokenId,
          mode === 'solo' ? seated?.session ?? msg.session : msg.session,
          mode === 'multi' ? String(msg.playerToken ?? '') : undefined,
          color,
        );
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'That name is already taken.';
        send(ws, { type: 'rejected', reason });
        ws.close(4003, reason);
        return;
      }
      if (mode === 'solo') {
        if (!known) fillSoloBots(world);
        const key = soloSave || joined.session;
        const entry = soloWorlds.get(key) ?? { world, touched: Date.now() };
        entry.world = world;
        entry.touched = Date.now();
        soloWorlds.set(key, entry);
      } else {
        joined.player.online = true;
        joined.player.offlineSince = 0;
        world.processOfflineSales(joined.player.id);
      }
      client = { ws, playerId: joined.player.id, world, mode, lastSeq: -1 };
      clients.set(ws, client);
      send(ws, { type: 'welcome', playerId: joined.player.id, session: joined.session, mode });
      client.lastSeq = snapshotFor(ws, world, joined.player.id);
      return;
    }

    if (!client) {
      send(ws, { type: 'rejected', reason: 'Join the board first.' });
      return;
    }

    if (msg.type === 'ping') {
      send(ws, { type: 'pong', t: msg.t, serverTime: Date.now() });
      return;
    }

    if (msg.type === 'resync') {
      send(ws, { type: 'resync', state: client.world.publicState(), private: client.world.privateState(client.playerId) });
      client.lastSeq = client.world.seq;
      return;
    }

    if (msg.type === 'market') {
      const tile = Number(msg.tile);
      if (Number.isInteger(tile)) send(ws, { type: 'market', tile, candles: client.world.marketHistory(tile) });
      return;
    }

    if (msg.type === 'intent' && msg.intent) {
      const intent = msg.intent;
      if ('key' in intent && !intent.key) {
        send(ws, { type: 'rejected', reason: 'Missing idempotency key.' });
        return;
      }
      const started = performance.now();
      const result = client.world.intent(client.playerId, intent);
      const elapsed = performance.now() - started;
      record(metrics.actionMs, elapsed);
      metrics.intents += 1;
      if (!result.ok) {
        metrics.rejected += 1;
        send(ws, { type: 'rejected', reason: result.reason ?? 'Action refused.', key: 'key' in intent ? intent.key : undefined });
      } else {
        send(ws, { type: 'private', private: client.world.privateState(client.playerId) });
      }
    }
  });

  ws.on('close', () => {
    if (!client) return;
    if (client.mode === 'multi') {
      client.world.disconnect(client.playerId);
      store.saveWorld(publicWorld.snapshot());
      metrics.lastSaveAt = Date.now();
    }
    clients.delete(ws);
    client = null;
  });
});

const TICK_MS = 100;
const lastPrivate = new Map<World, number>();

const gameLoop = setInterval(() => {
  const tickStarted = performance.now();
  const worlds = [publicWorld, ...[...soloWorlds.values()].map((s) => s.world)];
  for (const world of worlds) {
    world.tick(TICK_MS);
    world.expirePending();
    world.runBots();
    if (world.seq !== (frames.get(world)?.seq ?? -1)) broadcastBoard(world);
    if (world.seq !== (lastPrivate.get(world) ?? -1)) {
      lastPrivate.set(world, world.seq);
      for (const c of clientsIn(world)) {
        if (c.ws.bufferedAmount > SOFT_BUFFER) continue;
        send(c.ws, { type: 'private', private: world.privateState(c.playerId) });
      }
    }
  }

  publicWorld.processOfflineSales();

  if (publicWorld.dirty) {
    publicWorld.dirty = false;
    store.saveWorld(publicWorld.snapshot());
    metrics.lastSaveAt = Date.now();
  }

  for (const [key, entry] of soloWorlds) {
    if (!entry.world.dirty || Date.now() - (entry.saved ?? 0) < 1500) continue;
    entry.world.dirty = false;
    entry.saved = Date.now();
    store.saveSolo(key, entry.world.snapshot());
    metrics.lastSaveAt = Date.now();
  }
  record(metrics.tickMs, performance.now() - tickStarted);
}, TICK_MS);

const metricsTimer = setInterval(() => logMetrics('metrics'), 10_000);

server.listen(PORT, () => {
  console.log(JSON.stringify({ at: new Date().toISOString(), level: 'info', event: 'listening', port: PORT, protocol: PROTOCOL, version: BUILD, pid: process.pid }));
});

let shuttingDown = false;
let closedStore = false;
function closeStore(): void {
  if (closedStore) return;
  closedStore = true;
  try {
    store.close();
  } catch (error) {
    metrics.errors += 1;
    console.error(JSON.stringify({ at: new Date().toISOString(), level: 'error', event: 'store-close', error: error instanceof Error ? error.message : String(error) }));
  }
}

function shutdown(signal = 'SIGTERM', exitCode = 0): void {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(gameLoop);
  clearInterval(metricsTimer);
  logMetrics(`shutdown:${signal}`);
  for (const [key, entry] of soloWorlds) {
    entry.world.dirty = false;
    store.saveSolo(key, entry.world.snapshot());
  }
  store.saveWorld(publicWorld.snapshot(), true);
  metrics.lastSaveAt = Date.now();
  for (const ws of wss.clients) {
    try {
      ws.close(1001, 'server restart');
    } catch {
      ws.terminate();
    }
  }
  const done = (): void => {
    closeStore();
    process.exit(exitCode);
  };
  server.close(done);
  setTimeout(done, 1500).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (error) => {
  metrics.errors += 1;
  console.error(JSON.stringify({ at: new Date().toISOString(), level: 'fatal', event: 'uncaughtException', error: error.message, stack: error.stack }));
  shutdown('uncaughtException', 1);
});
process.on('unhandledRejection', (reason) => {
  metrics.errors += 1;
  console.error(JSON.stringify({ at: new Date().toISOString(), level: 'error', event: 'unhandledRejection', error: String(reason) }));
});

