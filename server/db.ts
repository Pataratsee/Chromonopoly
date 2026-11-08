import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { WorldSnapshot } from './world';

const DATA_DIR = path.resolve(import.meta.dirname, '..', 'data');
const DB_PATH = process.env.CHROMONOPOLY_DB ?? path.join(DATA_DIR, 'chromonopoly.db');

export interface Account {
  id: string;
  name: string;
  token_id: string;
  session: string;
  cash: number;
  position: number;
  reputation: number;
  updated_at: number;
}

export class Store {
  private readonly db: DatabaseSync;
  private lastSave = 0;

  constructor(file = DB_PATH) {
    if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        token_id TEXT NOT NULL,
        session TEXT NOT NULL UNIQUE,
        cash INTEGER NOT NULL,
        position INTEGER NOT NULL,
        reputation INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS world (
        id INTEGER PRIMARY KEY CHECK (id = 1),
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

  upsertAccount(a: Account): void {
    this.db
      .prepare(
        `INSERT INTO accounts (id, name, token_id, session, cash, position, reputation, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name, token_id = excluded.token_id, session = excluded.session,
           cash = excluded.cash, position = excluded.position,
           reputation = excluded.reputation, updated_at = excluded.updated_at`,
      )
      .run(a.id, a.name, a.token_id, a.session, a.cash, a.position, a.reputation, a.updated_at);
  }

  topAccounts(limit = 10): Account[] {
    return this.db
      .prepare('SELECT * FROM accounts ORDER BY cash DESC LIMIT ?')
      .all(limit) as unknown as Account[];
  }

  close(): void {
    this.db.close();
  }
}
