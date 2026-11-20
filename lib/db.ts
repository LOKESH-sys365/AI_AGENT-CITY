import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

export const dbPath = path.join(process.cwd(), "data", "city.db");
mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    google_id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    image TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cities (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    root_path TEXT NOT NULL,
    owner_id TEXT NOT NULL REFERENCES users(google_id)
  );

  CREATE TABLE IF NOT EXISTS outputs (
    id INTEGER PRIMARY KEY,
    city_id INTEGER NOT NULL REFERENCES cities(id),
    agent TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY,
    city_id INTEGER NOT NULL REFERENCES cities(id),
    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS google_credentials (
    google_id TEXT PRIMARY KEY NOT NULL REFERENCES users(google_id) ON DELETE CASCADE,
    encrypted_refresh_token TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    google_id TEXT PRIMARY KEY NOT NULL REFERENCES users(google_id) ON DELETE CASCADE,
    model TEXT NOT NULL,
    city_root TEXT NOT NULL,
    enabled_agents TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS a2a_tasks (
    owner_id TEXT NOT NULL REFERENCES users(google_id) ON DELETE CASCADE,
    task_id TEXT NOT NULL,
    context_id TEXT NOT NULL,
    status INTEGER NOT NULL,
    status_timestamp TEXT NOT NULL,
    task_json TEXT NOT NULL,
    PRIMARY KEY (owner_id, task_id)
  );

  CREATE INDEX IF NOT EXISTS a2a_tasks_owner_updated
    ON a2a_tasks (owner_id, status_timestamp DESC, task_id DESC);

  CREATE TABLE IF NOT EXISTS document_sources (
    id INTEGER PRIMARY KEY,
    city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(city_id, content_hash)
  );

  CREATE TABLE IF NOT EXISTS document_chunks (
    id INTEGER PRIMARY KEY,
    source_id INTEGER NOT NULL REFERENCES document_sources(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    token_count INTEGER NOT NULL,
    UNIQUE(source_id, chunk_index)
  );

  CREATE INDEX IF NOT EXISTS document_sources_city
    ON document_sources (city_id, id DESC);

  CREATE INDEX IF NOT EXISTS document_chunks_source
    ON document_chunks (source_id, chunk_index);

  CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id INTEGER PRIMARY KEY,
    city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    owner_id TEXT NOT NULL REFERENCES users(google_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    agent TEXT NOT NULL CHECK (agent IN ('mayor', 'librarian', 'professor', 'builder', 'planner')),
    task TEXT NOT NULL,
    weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    local_time TEXT NOT NULL,
    time_zone TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    last_run_date TEXT,
    last_started_at TEXT,
    last_finished_at TEXT,
    last_status TEXT CHECK (last_status IN ('running', 'success', 'failed')),
    last_error TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS scheduled_jobs_city_owner
    ON scheduled_jobs (city_id, owner_id, enabled);
`);

export default db;
