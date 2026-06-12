CREATE TABLE IF NOT EXISTS processed_updates (
  update_id INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  kcal REAL NOT NULL,
  serving REAL NOT NULL,
  unit TEXT NOT NULL,
  protein REAL NOT NULL DEFAULT 0,
  carbs REAL NOT NULL DEFAULT 0,
  fat REAL NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS recipes_active_name
ON recipes(active, name_key);

CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  telegram_message_id INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  telegram_chat_id TEXT,
  telegram_message_id INTEGER,
  created_at TEXT NOT NULL,
  acked_at TEXT
);

CREATE INDEX IF NOT EXISTS events_status_created
ON events(status, created_at);

CREATE TABLE IF NOT EXISTS daily_status (
  local_date TEXT PRIMARY KEY,
  snapshot_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
