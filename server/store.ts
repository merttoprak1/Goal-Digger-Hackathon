import { DatabaseSync } from 'node:sqlite';
import type { Challenge } from '../shared/contracts.ts';

export function createStore(path: string) {
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE IF NOT EXISTS challenges (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    payload TEXT NOT NULL
  )`);
  const insert = db.prepare('INSERT INTO challenges (id, created_at, payload) VALUES (?, ?, ?)');
  const select = db.prepare('SELECT payload FROM challenges WHERE id = ?');
  const list = db.prepare('SELECT payload FROM challenges ORDER BY created_at DESC, rowid DESC LIMIT 100');
  return {
    insert(challenge: Challenge) { insert.run(challenge.id, challenge.createdAt, JSON.stringify(challenge)); },
    get(id: string): Challenge | undefined {
      const row = select.get(id);
      return row ? JSON.parse(String(row.payload)) as Challenge : undefined;
    },
    list(): Challenge[] { return list.all().map((row) => JSON.parse(String(row.payload)) as Challenge); },
    close() { db.close(); },
  };
}

export type ChallengeStore = ReturnType<typeof createStore>;
