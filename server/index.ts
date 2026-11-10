import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { World, type TestSetup } from './world.ts';
import { Store } from './db.ts';
import type { GameEvent, GameMode, Intent, ServerMessage } from '../src/game/types.ts';
import { normalizeUsername, usernameIssue } from '../src/game/username.ts';

const PORT = Number(process.env.CHROMONOPOLY_PORT ?? process.env.PORT ?? 8787) || 8787;
const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const BUILD = process.env.RENDER_GIT_COMMIT ?? process.env.GIT_COMMIT ?? 'dev';
const PROTOCOL = 3;

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
};

const store = new Store();

interface Client {
  ws: WebSocket;
  playerId: string;
  world: World;
  mode: GameMode;
}

const clients = new Map<WebSocket, Client>();
const events: GameEvent[] = [];
const soloWorlds = new Map<string, { world: World; touched: number; saved?: number }>();

function clientsIn(world: World): Client[] {
  return [...clients.values()].filter((c) => c.world === world);
}

function broadcastWorld(world: World, message: ServerMessage): void {
  const payload = JSON.stringify(message);
  for (const client of clientsIn(world)) {
    if (message.type === 'event' && message.event?.audience?.length) {
      if (!message.event.audience.includes(client.playerId)) continue;
    }
    if (client.ws.readyState === WebSocket.OPEN) client.ws.send(payload);
  }
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

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
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
      version: BUILD,
      protocol: PROTOCOL,
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
    res.writeHead(200, {
      'content-type': MIME[ext] ?? 'application/octet-stream',
      'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=604800',
      'x-content-type-options': 'nosniff',
    });
    res.end(data);
  } catch {
    res.writeHead(404).end('Not found');
  }
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  let client: Client | null = null;

  ws.on('message', (raw) => {
    let msg: {
      type?: string;
      intent?: Intent;
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
      client = { ws, playerId: joined.player.id, world, mode };
      clients.set(ws, client);
      send(ws, { type: 'welcome', playerId: joined.player.id, session: joined.session, mode });
      send(ws, { type: 'state', state: world.publicState() });
      send(ws, { type: 'private', private: world.privateState(joined.player.id) });
      return;
    }

    if (!client) {
      send(ws, { type: 'rejected', reason: 'Join the board first.' });
      return;
    }

    if (msg.type === 'resync') {
      send(ws, { type: 'resync', state: client.world.publicState(), private: client.world.privateState(client.playerId) });
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
      const result = client.world.intent(client.playerId, intent);
      if (!result.ok) {
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
    }
    clients.delete(ws);
    client = null;
  });
});

const lastBroadcast = new Map<World, number>();
const lastPrivate = new Map<World, number>();

setInterval(() => {
  const worlds = [publicWorld, ...[...soloWorlds.values()].map((s) => s.world)];
  for (const world of worlds) {
    world.tick(100);
    world.expirePending();
    world.runBots();
    if (world.seq !== (lastBroadcast.get(world) ?? -1)) {
      lastBroadcast.set(world, world.seq);
      broadcastWorld(world, { type: 'state', state: world.publicState() });
    }
    if (world.seq !== (lastPrivate.get(world) ?? -1)) {
      lastPrivate.set(world, world.seq);
      for (const c of clientsIn(world)) {
        try {
          send(c.ws, { type: 'private', private: world.privateState(c.playerId) });
        } catch {
          // Disconnected clients are cleaned up by their close handler.
        }
      }
    }
  }

  // One job for every disconnected name. No per-player timers.
  publicWorld.processOfflineSales();

  if (publicWorld.dirty) {
    publicWorld.dirty = false;
    store.saveWorld(publicWorld.snapshot());
  }

  for (const [key, entry] of soloWorlds) {
    if (!entry.world.dirty || Date.now() - (entry.saved ?? 0) < 1500) continue;
    entry.world.dirty = false;
    entry.saved = Date.now();
    store.saveSolo(key, entry.world.snapshot());
  }
}, 80);

server.listen(PORT, () => {
  console.log(`Chromonopoly server on http://localhost:${PORT}  (ws://localhost:${PORT}/ws)`);
});

function shutdown(): void {
  store.saveWorld(publicWorld.snapshot(), true);
  store.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1200);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
