#!/usr/bin/env node
/**
 * 100-client Round 10 soak.
 *
 * Starts its own isolated built server so the run also proves graceful restart
 * and seat recovery. Each client owns a solo table, keeps a heartbeat and
 * reconnects with jittered backoff. Server health supplies the authoritative
 * action p95, delta/full counts and backpressure counters.
 */
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import WebSocket from 'ws';

const ROOT = process.cwd();
const PORT = Number(process.env.SOAK_PORT ?? 8791);
const CLIENTS = Number(process.env.SOAK_CLIENTS ?? 100);
const DURATION_MS = Number(process.env.SOAK_MS ?? 600_000);
const OUT = process.env.SOAK_OUT ?? 'docs/round10-proof/soak-100.json';
const DB = process.env.SOAK_DB ?? '/tmp/chromonopoly-soak.db';
const HEALTH = `http://127.0.0.1:${PORT}/api/health`;
const WS = `ws://127.0.0.1:${PORT}/ws`;
mkdirSync('docs/round10-proof', { recursive: true });

let server = null;
let serverRestarts = 0;
const serverStartedAt = () => Date.now();
let logs = null;
const runId = Date.now().toString(36);

function startServer() {
  logs = createWriteStream('docs/round10-proof/soak-server.log', { flags: 'a' });
  logs.write(`\n=== soak server start ${new Date().toISOString()} ===\n`);
  const child = spawn(process.execPath, ['dist-server/index.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      CHROMONOPOLY_TEST: '1',
      BOTS: '0',
      CHROMONOPOLY_PORT: String(PORT),
      CHROMONOPOLY_DB: DB,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.pipe(logs, { end: false });
  child.stderr.pipe(logs, { end: false });
  return child;
}

async function waitHealth(timeoutMs = 20_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const res = await fetch(HEALTH);
      if (res.ok) return await res.json();
    } catch { /* starting */ }
    await delay(150);
  }
  throw new Error('server health did not become ready');
}

async function stopServer() {
  if (!server || server.exitCode !== null) return;
  const closed = new Promise((resolve) => server.once('exit', resolve));
  server.kill('SIGTERM');
  await Promise.race([closed, delay(15_000)]);
  if (server.exitCode === null) server.kill('SIGKILL');
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

class SoakClient {
  constructor(index) {
    this.index = index;
    this.name = `Soak${index}`.slice(0, 16);
    this.soloKey = `${runId}-${index}`;
    this.ws = null;
    this.session = null;
    this.playerId = null;
    this.attempts = 0;
    this.closedByUs = false;
    this.joined = false;
    this.recovered = false;
    this.messages = 0;
    this.deltas = 0;
    this.fullStates = 0;
    this.bytes = 0;
    this.pings = [];
    this.outagePings = [];
    this.errors = [];
    this.actionSeq = 0;
    this.pingAt = 0;
    this.lastStateSeq = -1;
    this.connect();
  }

  connect() {
    if (this.closedByUs) return;
    const ws = new WebSocket(WS);
    this.ws = ws;
    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'hello',
        name: this.name,
        tokenId: 'cat',
        mode: 'solo',
        soloKey: this.soloKey,
        session: this.session ?? undefined,
        fresh: !this.session,
      }));
      this.pingAt = Date.now();
      ws.send(JSON.stringify({ type: 'ping', t: this.pingAt }));
    });
    ws.on('message', (raw) => {
      this.messages += 1;
      this.bytes += raw.length;
      let msg;
      try { msg = JSON.parse(String(raw)); } catch { return; }
      if (msg.type === 'welcome') {
        if (this.joined) this.recovered = true;
        this.joined = true;
        this.attempts = 0;
        this.session = msg.session ?? this.session;
        this.playerId = msg.playerId ?? this.playerId;
      } else if (msg.type === 'pong') {
        if (this.pingAt) this.pings.push(Math.max(0, Date.now() - this.pingAt));
      } else if (msg.type === 'delta') {
        this.deltas += 1;
        this.lastStateSeq = msg.seq ?? this.lastStateSeq;
      } else if (msg.type === 'state' || msg.type === 'resync') {
        this.fullStates += 1;
        this.lastStateSeq = msg.state?.seq ?? this.lastStateSeq;
      } else if (msg.type === 'rejected') {
        this.errors.push(msg.reason ?? 'rejected');
      }
    });
    ws.on('error', (error) => this.errors.push(error.message));
    ws.on('close', () => {
      if (this.closedByUs) return;
      this.attempts += 1;
      const backoff = Math.min(5000, 500 * 2 ** Math.min(5, this.attempts)) + Math.random() * 250;
      setTimeout(() => this.connect(), backoff).unref();
    });
  }

  ping() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.pingAt = Date.now();
      this.ws.send(JSON.stringify({ type: 'ping', t: this.pingAt }));
    }
  }

  act() {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.actionSeq += 1;
    this.ws.send(JSON.stringify({
      type: 'intent',
      intent: { t: 'roll', key: `soak-${runId}-${this.index}-${this.actionSeq}` },
    }));
  }

  close() {
    this.closedByUs = true;
    this.ws?.close(1000, 'soak complete');
  }
}

async function main() {
  rmSync(DB, { force: true });
  rmSync(`${DB}-shm`, { force: true });
  rmSync(`${DB}-wal`, { force: true });
  rmSync('docs/round10-proof/soak-server.log', { force: true });
  server = startServer();
  await waitHealth(30_000);
  const started = Date.now();
  console.log(`soak: starting ${CLIENTS} clients for ${Math.round(DURATION_MS / 1000)}s on port ${PORT}`);
  const clients = Array.from({ length: CLIENTS }, (_, index) => new SoakClient(index));
  const health = [];
  const sampler = setInterval(async () => {
    try {
      const res = await fetch(HEALTH);
      if (res.ok) health.push({ at: Date.now() - started, ...(await res.json()) });
    } catch { /* during restart */ }
  }, 5000);
  const pinger = setInterval(() => clients.forEach((client) => client.ping()), 10_000);
  const actor = setInterval(() => clients.forEach((client) => client.act()), 5000);

  // Flaky-network proof at 20%: hard-drop a handful and let their reconnect
  // loops recover the same persisted seats.
  const flakyAt = Math.round(DURATION_MS * 0.2);
  const restartAt = Math.round(DURATION_MS * 0.5);
  let flakyChecked = false;
  let flakyRecovered = 0;
  let restartChecked = false;
  let restartWindow = null;
  while (Date.now() - started < DURATION_MS) {
    const elapsed = Date.now() - started;
    if (!flakyChecked && elapsed >= flakyAt) {
      flakyChecked = true;
      console.log('soak: dropping 5 sockets for flaky-network recovery');
      for (const client of clients.slice(0, 5)) client.ws?.terminate();
      await delay(12_000);
      flakyRecovered = clients.slice(0, 5).filter((client) => client.ws?.readyState === WebSocket.OPEN && client.recovered).length;
    }
    if (!restartChecked && elapsed >= restartAt) {
      restartChecked = true;
      console.log('soak: restarting server, waiting for seats to recover');
      const before = health.at(-1)?.uptime ?? 0;
      await stopServer();
      server = startServer();
      serverRestarts += 1;
      await waitHealth(30_000);
      const afterStart = Date.now();
      while (Date.now() - afterStart < 45_000) {
        if (clients.every((client) => client.ws?.readyState === WebSocket.OPEN)) break;
        await delay(250);
      }
      const recovered = await waitHealth(5_000).catch(() => null);
      restartWindow = { uptimeBefore: before, uptimeAfter: recovered?.uptime ?? null, clientsOpen: clients.filter((c) => c.ws?.readyState === WebSocket.OPEN).length, at: elapsed };
      console.log('soak: restart recovery', restartWindow);
    }
    await delay(500);
  }
  clearInterval(sampler);
  clearInterval(pinger);
  clearInterval(actor);
  await delay(500);
  const finalHealth = await waitHealth(5000).catch(() => null);
  clients.forEach((client) => client.close());
  await stopServer();

  const pings = clients.flatMap((client) => client.pings);
  const connected = clients.filter((client) => client.joined).length;
  const recovered = clients.filter((client) => client.recovered).length;
  const deltas = clients.reduce((sum, client) => sum + client.deltas, 0);
  const fullStates = clients.reduce((sum, client) => sum + client.fullStates, 0);
  const bytes = clients.reduce((sum, client) => sum + client.bytes, 0);
  const errors = clients.flatMap((client) => client.errors).slice(0, 40);
  const p95Ping = percentile(pings, 0.95);
  const actionP95 = percentile(health.map((h) => h.p95ActionMs).filter((n) => Number.isFinite(n)), 0.95);
  const tickP95 = percentile(health.map((h) => h.p95TickMs).filter((n) => Number.isFinite(n)), 0.95);
  const report = {
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    clientsRequested: CLIENTS,
    connected,
    recoveredSeats: recovered,
    serverRestarts,
    restartWindow,
    flakyNetwork: { dropped: 5, recovered: flakyRecovered },
    pings: { count: pings.length, p50: percentile(pings, 0.5), p95: p95Ping, max: Math.max(0, ...pings) },
    outagePings: { count: clients.flatMap((client) => client.outagePings).length, max: Math.max(0, ...clients.flatMap((client) => client.outagePings)) },
    server: finalHealth,
    health: {
      samples: health.length,
      actionP95: actionP95,
      tickP95: tickP95,
      maxDroppedUpdates: Math.max(0, ...health.map((h) => h.droppedUpdates ?? 0)),
      deltaFrames: health.at(-1)?.deltaFrames ?? 0,
      fullFrames: health.at(-1)?.fullFrames ?? 0,
    },
    actionsSent: clients.reduce((sum, c) => sum + c.actionSeq, 0),
    clientTraffic: { messages: clients.reduce((sum, c) => sum + c.messages, 0), deltas, fullStates, bytes, deltaRatio: deltas / Math.max(1, deltas + fullStates) },
    errors,
    assertions: {
      hundredClients: connected === CLIENTS,
      actionP95Under150: actionP95 > 0 && actionP95 < 150,
      pingP95Under150: p95Ping > 0 && p95Ping < 150,
      deltaTraffic: deltas > 0,
      flakyRecovered: flakyRecovered === 5,
      restartRecovered: Boolean(restartWindow && restartWindow.uptimeAfter !== null && restartWindow.uptimeAfter < restartWindow.uptimeBefore),
    },
  };
  mkdirSync('docs/round10-proof', { recursive: true });
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ report: OUT, ...report.assertions, p95Ping, actionP95, connected, recovered }, null, 2));
  if (!Object.values(report.assertions).every(Boolean)) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error(error);
  await stopServer();
  writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
});
