import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { WorldSnapshot } from './world';

const DATA_DIR = path.resolve(import.meta.dirname, '..', 'data');
const DB_PATH = process.env.CHROMONOPOLY_DB ?? path.join(DATA_DIR, 'chromonopoly.db');

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
      CREATE TABLE IF NOT EXISTS solo_saves (
        id TEXT PRIMARY KEY,
        snapshot TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      DROP TABLE IF EXISTS auth_accounts;
      DROP TABLE IF EXISTS auth_sessions;
      DROP TABLE IF EXISTS accounts;
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

  close(): void {
    this.db.close();
  }
}
