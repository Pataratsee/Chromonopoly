import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { WebSocketServer, WebSocket } from 'ws';
import { World, type TestSetup } from './world.ts';
import { Store, type Account } from './db.ts';
import type { GameEvent, GameMode, Intent, ServerMessage } from '../src/game/types.ts';

// Hosts such as Render inject PORT; CHROMONOPOLY_PORT keeps local/test ports explicit.
const PORT = Number(process.env.CHROMONOPOLY_PORT ?? process.env.PORT ?? 8787) || 8787;
const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const BCRYPT_COST = 11;
const LOGIN_WINDOW_MS = 5 * 60 * 1000;
const LOGIN_MAX = 10;

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
/** One live socket per account. A second sign-in takes the seat over. */
const accountSockets = new Map<string, WebSocket>();
const events: GameEvent[] = [];
const soloWorlds = new Map<string, { world: World; touched: number; saved?: number }>();
const loginAttempts = new Map<string, number[]>();

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
  // A multiplayer seat must map to a surviving password account. This is the
  // second line of defence after the one-time database purge.
  publicWorld.purgeUnauthenticated(store.accountIds());
  console.log(`restored public world with ${publicWorld.players.size} account players, seq ${publicWorld.seq}`);
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

function cors(req: IncomingMessage, res: ServerResponse): void {
  res.setHeader('access-control-allow-origin', req.headers.origin ?? '*');
  res.setHeader('vary', 'Origin');
  res.setHeader('access-control-allow-headers', 'content-type, authorization');
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 10_000) throw new Error('Request too large');
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error('Invalid JSON');
  }
}

function bearer(req: IncomingMessage): string {
  const value = String(req.headers.authorization ?? '');
  return value.startsWith('Bearer ') ? value.slice(7) : '';
}

function publicAccount(account: Account): { id: string; username: string } {
  return { id: account.id, username: account.username };
}

function validUsername(username: string): boolean {
  return /^[A-Za-z0-9_]{3,16}$/.test(username);
}

function loginLimit(key: string): boolean {
  const now = Date.now();
  const recent = (loginAttempts.get(key) ?? []).filter((at) => now - at < LOGIN_WINDOW_MS);
  if (recent.length >= LOGIN_MAX) {
    loginAttempts.set(key, recent);
    return false;
  }
  recent.push(now);
  loginAttempts.set(key, recent);
  return true;
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
      seq: publicWorld.seq,
      soloTables: soloWorlds.size,
      uptime: process.uptime(),
      accounts: store.topAccounts(1000).length,
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

  if (url.pathname === '/api/auth/register' && req.method === 'POST') {
    try {
      const data = await body(req);
      const username = String(data.username ?? '').trim();
      const password = String(data.password ?? '');
      if (!validUsername(username)) {
        json(res, 400, { error: 'Username must be 3–16 letters, numbers or underscores.' });
        return;
      }
      if (password.length < 6 || password.length > 128) {
        json(res, 400, { error: 'Password must be at least 6 characters.' });
        return;
      }
      const hash = await bcrypt.hash(password, BCRYPT_COST);
      const account = store.createAccount(username, hash);
      const token = store.createSession(account.id);
      json(res, 201, { account: publicAccount(account), token });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not create the account.';
      json(res, /UNIQUE/i.test(message) ? 409 : 400, {
        error: /UNIQUE/i.test(message) ? 'That username is already taken.' : message,
      });
    }
    return;
  }

  if (url.pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const data = await body(req);
      const username = String(data.username ?? '').trim();
      const password = String(data.password ?? '');
      const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? 'unknown').split(',')[0]!.trim();
      if (!loginLimit(`${ip}:${username.toLowerCase()}`)) {
        json(res, 429, { error: 'Too many login attempts. Wait a few minutes and try again.' });
        return;
      }
      const account = store.findAuthAccount(username);
      const valid = account ? await bcrypt.compare(password, account.password_hash) : false;
      if (!account || !valid) {
        json(res, 401, { error: 'Wrong username or password.' });
        return;
      }
      // A new login is the only session for this account; old tabs must not
      // keep a stale seat alive after the user signs in on another device.
      const token = store.replaceSession(account.id);
      json(res, 200, { account: publicAccount(account), token });
    } catch (error) {
      json(res, 400, { error: error instanceof Error ? error.message : 'Login failed.' });
    }
    return;
  }

  if (url.pathname === '/api/auth/session' && req.method === 'GET') {
    const account = store.sessionAccount(bearer(req));
    if (!account) {
      json(res, 401, { error: 'Sign in again.' });
      return;
    }
    json(res, 200, { account: publicAccount(account) });
    return;
  }

  if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
    const token = bearer(req);
    const account = store.sessionAccount(token);
    store.revokeSession(token);
    if (account) {
      const socket = accountSockets.get(account.id);
      if (socket) socket.close(4001, 'signed out');
      accountSockets.delete(account.id);
    }
    json(res, 200, { ok: true });
    return;
  }

  if (url.pathname === '/api/leaderboard') {
    json(res, 200, store.topAccounts(10));
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
      const targetWorld = parsed.mode === 'solo' ? soloWorlds.get(parsed.session)?.world : publicWorld;
      if (!targetWorld) throw new Error('no world for that session');
      const result = targetWorld.testSetup(parsed.session, parsed.setup);
      json(res, result.ok ? 200 : 400, result);
    } catch (err) {
      json(res, 400, { ok: false, reason: err instanceof Error ? err.message : 'bad request' });
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
    let msg: {
      type?: string;
      intent?: Intent;
      name?: string;
      tokenId?: string;
      session?: string;
      mode?: GameMode;
      authToken?: string;
      soloKey?: string;
      fresh?: boolean;
      color?: string;
    };
    try {
      msg = JSON.parse(String(raw));
    } catch {
      send(ws, { type: 'rejected', reason: 'Malformed message.' });
      return;
    }

    if (msg.type === 'hello') {
      const mode: GameMode = msg.mode === 'solo' ? 'solo' : 'multi';
      const account = mode === 'multi' ? store.sessionAccount(String(msg.authToken ?? '')) : null;
      if (mode === 'multi' && !account) {
        send(ws, { type: 'rejected', reason: 'Sign in to join multiplayer.' });
        ws.close(4001, 'authentication required');
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
      const name = account?.username ?? (String(msg.name ?? '').trim() || 'Tycoon');
      if (account) {
        const existing = accountSockets.get(account.id);
        if (existing && existing !== ws) {
          existing.close(4002, 'Signed in on another device.');
        }
        accountSockets.set(account.id, ws);
      }
      // A restored single-player table already holds its human seat; reuse that
      // seat instead of seating a second copy of the player.
      const seated = mode === 'solo' ? [...world.players.values()].find((p) => !p.isBot) : undefined;
      const { player, session } = world.join(name, tokenId, seated?.session ?? msg.session, account?.id, color);
      if (mode === 'solo') {
        if (!known) fillSoloBots(world);
        const key = soloSave || session;
        const entry = soloWorlds.get(key) ?? { world, touched: Date.now() };
        entry.world = world;
        entry.touched = Date.now();
        soloWorlds.set(key, entry);
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
    if (client.mode === 'multi') {
      const account = [...accountSockets.entries()].find(([, socket]) => socket === ws);
      if (account) accountSockets.delete(account[0]);
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
          // A disconnect owns this client. The next tick will skip it.
        }
      }
    }
  }

  if (publicWorld.dirty) {
    publicWorld.dirty = false;
    store.saveWorld(publicWorld.snapshot());
  }

  // Autosave every single-player table to its browser key, at most every 1.5 s.
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
