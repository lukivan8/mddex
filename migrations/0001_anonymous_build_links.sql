CREATE TABLE users (
  id TEXT PRIMARY KEY,
  account_id TEXT UNIQUE,
  created_at INTEGER NOT NULL
);
CREATE TABLE anonymous_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL
);
CREATE INDEX anonymous_sessions_user ON anonymous_sessions(user_id);
CREATE TABLE build_links (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  creator_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  UNIQUE(creator_id, token_hash)
);
