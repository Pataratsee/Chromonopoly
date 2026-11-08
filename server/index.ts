import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { World, type TestSetup } from './world.ts';
import { Store } from './db.ts';
import type { GameEvent, GameMode, Intent, ServerMessage } from '../src/game/types.ts';

// Deliberately not the ambient PORT variable: this game owns one fixed port.
const PORT = Number(process.env.CHROMONOPOLY_PORT ?? 8787) || 8787;
const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');

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
const soloWorlds = new Map<string, { world: World; touched: number }>();

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

const saved = store.loadWorld();
if (saved) {
  publicWorld.restore(saved);
  publicWorld.purgeBots();
  console.log(`restored public world with ${publicWorld.players.size} real players, seq ${publicWorld.seq}`);
}

const BOT_TOKENS = ['dog', 'taxi', 'penguin', 'chest', 'locomotive', 'panda'];

function fillSoloBots(world: World): void {
  while ([...world.players.values()].filter((p) => p.isBot).length < 3) {
    world.addBot(BOT_TOKENS);
  }
}

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify({
      ok: true,
      players: publicWorld.players.size,
      seq: publicWorld.seq,
      soloTables: soloWorlds.size,
      uptime: process.uptime(),
    }));
    return;
  }
  if (url.pathname === '/api/leaderboard') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(store.topAccounts(10)));
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
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ok: true }));
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
      const body = JSON.parse(raw) as { session?: string; setup?: TestSetup; mode?: GameMode };
      if (!body.session || !body.setup) throw new Error('session and setup are required');
      const targetWorld = body.mode === 'solo' ? soloWorlds.get(body.session)?.world : publicWorld;
      if (!targetWorld) throw new Error('no world for that session');
      const result = targetWorld.testSetup(body.session, body.setup);
      res.writeHead(result.ok ? 200 : 400, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(400, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ ok: false, reason: err instanceof Error ? err.message : 'bad request' }));
    }
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
    let msg: { type?: string; intent?: Intent; name?: string; tokenId?: string; session?: string; mode?: GameMode };
    try {
      msg = JSON.parse(String(raw));
    } catch {
      send(ws, { type: 'rejected', reason: 'Malformed message.' });
      return;
    }

    if (msg.type === 'hello') {
      const mode: GameMode = msg.mode === 'solo' ? 'solo' : 'multi';
      const name = String(msg.name ?? '').trim() || 'Tycoon';
      const tokenId = String(msg.tokenId ?? 'cat');
      let world = publicWorld;
      let known: { world: World; touched: number } | undefined;
      if (mode === 'solo') {
        known = msg.session ? soloWorlds.get(msg.session) : undefined;
        if (known) {
          world = known.world;
          known.touched = Date.now();
        } else {
          world = newWorld('solo');
        }
      }
      const { player, session } = world.join(name, tokenId, msg.session);
      if (mode === 'solo') {
        if (!known) fillSoloBots(world);
        const entry = soloWorlds.get(session) ?? { world, touched: Date.now() };
        entry.world = world;
        entry.touched = Date.now();
        soloWorlds.set(session, entry);
      }
      client = { ws, playerId: player.id, world, mode };
      clients.set(ws, client);
      send(ws, { type: 'welcome', playerId: player.id, session, mode });
      send(ws, { type: 'state', state: world.publicState() });
      send(ws, { type: 'private', private: world.privateState(player.id) });
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
          // A disconnect owns this client. The next tick will skip it.
        }
      }
    }
  }

  if (publicWorld.dirty) {
    publicWorld.dirty = false;
    store.saveWorld(publicWorld.snapshot());
    for (const p of publicWorld.players.values()) {
      store.upsertAccount({
        id: p.id,
        name: p.name,
        token_id: p.tokenId,
        session: p.session,
        cash: p.cash,
        position: p.position,
        reputation: p.reputation,
        updated_at: Date.now(),
      });
    }
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

