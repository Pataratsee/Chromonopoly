import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { WorldSnapshot } from './world';

const DATA_DIR = path.resolve(import.meta.dirname, '..', 'data');
const DB_PATH = process.env.CHROMONOPOLY_DB ?? path.join(DATA_DIR, 'chromonopoly.db');
const SESSION_DAYS = 30;

export interface Account {
  id: string;
  username: string;
  created_at: number;
}

export interface AuthAccount extends Account {
  password_hash: string;
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export class Store {
  private readonly db: DatabaseSync;
  private lastSave = 0;

  constructor(file = DB_PATH) {
    if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS world (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        snapshot TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // One-time Round 7 migration: remove every guest/test account and the old
    // world that contained them. New password accounts are untouched from the
    // second boot onward.
    const migrated = this.db.prepare('SELECT value FROM meta WHERE key = ?').get('round7-auth-purge');
    if (!migrated) {
      this.db.exec(`
        DROP TABLE IF EXISTS accounts;
        DELETE FROM world;
        INSERT INTO meta (key, value) VALUES ('round7-auth-purge', '1')
          ON CONFLICT(key) DO UPDATE SET value = excluded.value;
      `);
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS auth_accounts (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        username_lower TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS auth_sessions (
        token_hash TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_seen INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS solo_saves (
        id TEXT PRIMARY KEY,
        snapshot TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  saveWorld(snapshot: WorldSnapshot, force = false): void {
    const now = Date.now();
    if (!force && now - this.lastSave < 1500) return;
    this.lastSave = now;
    const json = JSON.stringify(snapshot, (_k, v) => (v instanceof Map ? [...v.entries()] : v));
    this.db
      .prepare(
        `INSERT INTO world (id, snapshot, updated_at) VALUES (1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET snapshot = excluded.snapshot, updated_at = excluded.updated_at`,
      )
      .run(json, now);
  }

  loadWorld(): WorldSnapshot | null {
    const row = this.db.prepare('SELECT snapshot FROM world WHERE id = 1').get() as { snapshot?: string } | undefined;
    if (!row?.snapshot) return null;
    try {
      return JSON.parse(row.snapshot) as WorldSnapshot;
    } catch {
      return null;
    }
  }

  createAccount(username: string, passwordHash: string): Account {
    const account: Account = { id: randomUUID(), username, created_at: Date.now() };
    this.db
      .prepare('INSERT INTO auth_accounts (id, username, username_lower, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(account.id, username, username.toLowerCase(), passwordHash, account.created_at);
    return account;
  }

  findAuthAccount(username: string): AuthAccount | null {
    const row = this.db
      .prepare('SELECT id, username, password_hash, created_at FROM auth_accounts WHERE username_lower = ?')
      .get(username.toLowerCase()) as AuthAccount | undefined;
    return row ?? null;
  }

  accountById(id: string): Account | null {
    const row = this.db
      .prepare('SELECT id, username, created_at FROM auth_accounts WHERE id = ?')
      .get(id) as Account | undefined;
    return row ?? null;
  }

  createSession(accountId: string): string {
    const token = randomBytes(32).toString('base64url');
    const now = Date.now();
    this.db
      .prepare('INSERT INTO auth_sessions (token_hash, account_id, created_at, last_seen) VALUES (?, ?, ?, ?)')
      .run(tokenHash(token), accountId, now, now);
    this.db
      .prepare('DELETE FROM auth_sessions WHERE created_at < ?')
      .run(now - SESSION_DAYS * 24 * 60 * 60 * 1000);
    return token;
  }

  /** Replaces every other session for the account. One account, one live login. */
  replaceSession(accountId: string): string {
    this.db.prepare('DELETE FROM auth_sessions WHERE account_id = ?').run(accountId);
    return this.createSession(accountId);
  }

  sessionAccount(token: string): Account | null {
    if (!token) return null;
    const row = this.db
      .prepare(
        `SELECT a.id, a.username, a.created_at
         FROM auth_sessions s JOIN auth_accounts a ON a.id = s.account_id
         WHERE s.token_hash = ?`,
      )
      .get(tokenHash(token)) as Account | undefined;
    if (!row) return null;
    this.db.prepare('UPDATE auth_sessions SET last_seen = ? WHERE token_hash = ?').run(Date.now(), tokenHash(token));
    return row;
  }

  revokeSession(token: string): void {
    if (!token) return;
    this.db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(tokenHash(token));
  }

  saveSolo(id: string, snapshot: WorldSnapshot): void {
    const json = JSON.stringify(snapshot, (_k, v) => (v instanceof Map ? [...v.entries()] : v));
    this.db
      .prepare(
        `INSERT INTO solo_saves (id, snapshot, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET snapshot = excluded.snapshot, updated_at = excluded.updated_at`,
      )
      .run(id, json, Date.now());
  }

  deleteSolo(id: string): void {
    this.db.prepare('DELETE FROM solo_saves WHERE id = ?').run(id);
  }

  loadSolo(id: string): WorldSnapshot | null {
    const row = this.db.prepare('SELECT snapshot FROM solo_saves WHERE id = ?').get(id) as { snapshot?: string } | undefined;
    if (!row?.snapshot) return null;
    try {
      return JSON.parse(row.snapshot) as WorldSnapshot;
    } catch {
      return null;
    }
  }

  soloMeta(id: string): { exists: boolean; corrupt?: boolean; updatedAt?: number; turnNumber?: number; playerName?: string; played?: number } {
    const row = this.db.prepare('SELECT snapshot, updated_at FROM solo_saves WHERE id = ?').get(id) as { snapshot?: string; updated_at?: number } | undefined;
    if (!row?.snapshot) return { exists: false };
    try {
      const snap = JSON.parse(row.snapshot) as WorldSnapshot;
      const players = Array.isArray(snap.players) ? snap.players : [];
      const human = players.find((p) => !(p as { isBot?: boolean }).isBot) as { name?: string } | undefined;
      return {
        exists: true,
        updatedAt: row.updated_at,
        turnNumber: snap.turnNumber ?? 1,
        playerName: human?.name ?? 'Your table',
        played: players.length,
      };
    } catch {
      return { exists: false, corrupt: true, updatedAt: row.updated_at };
    }
  }

  accountIds(): Set<string> {
    const rows = this.db.prepare('SELECT id FROM auth_accounts').all() as Array<{ id: string }>;
    return new Set(rows.map((row) => row.id));
  }

  topAccounts(limit = 10): Account[] {
    return this.db
      .prepare('SELECT id, username, created_at FROM auth_accounts ORDER BY created_at ASC LIMIT ?')
      .all(limit) as unknown as Account[];
  }

  close(): void {
    this.db.close();
  }
}
