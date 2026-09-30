ALTER TABLE community_builds ADD COLUMN state TEXT NOT NULL DEFAULT 'published' CHECK (state IN ('published', 'deleted'));
ALTER TABLE community_builds ADD COLUMN deleted_at INTEGER;
CREATE INDEX community_builds_state_recent ON community_builds(state, created_at DESC, id DESC);
