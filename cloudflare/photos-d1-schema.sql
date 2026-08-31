CREATE TABLE IF NOT EXISTS photo_uploads (
  id TEXT PRIMARY KEY,
  drive_file_id TEXT NOT NULL UNIQUE,
  completion_token_hash TEXT NOT NULL,
  guest_session_id TEXT NOT NULL,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type = 'image/jpeg'),
  byte_size INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 20971520),
  width INTEGER NOT NULL CHECK (width > 0 AND width <= 20000),
  height INTEGER NOT NULL CHECK (height > 0 AND height <= 20000),
  status TEXT NOT NULL CHECK (status IN ('pending', 'ready', 'missing')),
  created_at TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_photo_uploads_gallery
  ON photo_uploads (status, completed_at, id);

CREATE INDEX IF NOT EXISTS idx_photo_uploads_rate_limit
  ON photo_uploads (guest_session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_photo_uploads_expiry
  ON photo_uploads (status, expires_at);
