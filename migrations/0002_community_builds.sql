CREATE TABLE community_builds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  build_json TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  description_json TEXT NOT NULL,
  description_text TEXT NOT NULL,
  display_name TEXT NOT NULL,
  discord TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX community_builds_recent ON community_builds(created_at DESC, id DESC);
CREATE TABLE community_edit_tokens (
  token_hash TEXT PRIMARY KEY,
  build_id TEXT NOT NULL REFERENCES community_builds(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE community_edit_sessions (
  token_hash TEXT PRIMARY KEY,
  build_id TEXT NOT NULL REFERENCES community_builds(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX community_edit_tokens_expiry ON community_edit_tokens(expires_at);
CREATE INDEX community_edit_sessions_expiry ON community_edit_sessions(expires_at);
