CREATE TABLE IF NOT EXISTS minigame_sessions (
  token TEXT PRIMARY KEY,
  player_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL COLLATE NOCASE,
  hero_key TEXT NOT NULL CHECK (hero_key IN ('otto', 'sabrina')),
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_minigame_sessions_expires_at
  ON minigame_sessions (expires_at);

CREATE TABLE IF NOT EXISTS minigame_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  hero_key TEXT NOT NULL CHECK (hero_key IN ('otto', 'sabrina')),
  score INTEGER NOT NULL,
  coins INTEGER NOT NULL,
  time_remaining INTEGER NOT NULL,
  lives INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  level_index INTEGER NOT NULL,
  levels_cleared INTEGER NOT NULL,
  completed_at TEXT NOT NULL,
  session_token TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_minigame_scores_ranking
  ON minigame_scores (score DESC, completed_at ASC, id ASC);
