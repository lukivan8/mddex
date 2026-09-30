ALTER TABLE community_builds ADD COLUMN publish_key TEXT;
ALTER TABLE community_builds ADD COLUMN publish_hash TEXT;
CREATE UNIQUE INDEX community_builds_publish_key ON community_builds(email, publish_key);
CREATE TABLE community_email_challenges (
  id TEXT PRIMARY KEY,
  request_key TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  build_id TEXT,
  code_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  session_hash TEXT,
  verified_at INTEGER
);
CREATE INDEX community_email_challenges_email ON community_email_challenges(email, created_at);
CREATE INDEX community_email_challenges_expiry ON community_email_challenges(expires_at);
CREATE TABLE community_email_sessions (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX community_email_sessions_expiry ON community_email_sessions(expires_at);
-- Replace the former build-specific confirmation links with email identity sessions.
DELETE FROM community_edit_tokens;
DELETE FROM community_edit_sessions;
