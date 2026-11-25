PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS devices (
 id TEXT PRIMARY KEY,
 identity_id TEXT NOT NULL REFERENCES identities(id),
 token_hash TEXT UNIQUE NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE,
 label TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 last_used_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS devices_identity ON devices(identity_id);
INSERT INTO devices(id,identity_id,token_hash,label,created_at,last_used_at)
 SELECT lower(hex(randomblob(16))),identity_id,token_hash,'Existing browser',created_at,created_at
 FROM sessions WHERE token_hash NOT IN (SELECT token_hash FROM devices);
