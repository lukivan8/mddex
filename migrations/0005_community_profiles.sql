-- Display-name ownership survives session expiry and soft deletion.
CREATE TABLE community_profiles (
  email TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);
-- Existing creators keep their earliest posted name. Conflicting legacy names
-- fail the migration rather than silently transferring ownership.
INSERT INTO community_profiles (email, display_name, name_key, created_at)
SELECT email, display_name, lower(trim(display_name)), created_at
FROM (
  SELECT email, display_name, created_at,
    ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at, id) AS position
  FROM community_builds
)
WHERE position = 1;
