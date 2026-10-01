-- Auth.js tables and KlipCode workspace. Applied explicitly with Wrangler.
CREATE TABLE IF NOT EXISTS "accounts" (
    "id" text NOT NULL,
    "userId" text NOT NULL DEFAULT NULL,
    "type" text NOT NULL DEFAULT NULL,
    "provider" text NOT NULL DEFAULT NULL,
    "providerAccountId" text NOT NULL DEFAULT NULL,
    "refresh_token" text DEFAULT NULL,
    "access_token" text DEFAULT NULL,
    "expires_at" number DEFAULT NULL,
    "token_type" text DEFAULT NULL,
    "scope" text DEFAULT NULL,
    "id_token" text DEFAULT NULL,
    "session_state" text DEFAULT NULL,
    "oauth_token_secret" text DEFAULT NULL,
    "oauth_token" text DEFAULT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "sessions" (
    "id" text NOT NULL,
    "sessionToken" text NOT NULL,
    "userId" text NOT NULL DEFAULT NULL,
    "expires" datetime NOT NULL DEFAULT NULL,
    PRIMARY KEY (sessionToken)
);

CREATE TABLE IF NOT EXISTS "users" (
    "id" text NOT NULL DEFAULT '',
    "name" text DEFAULT NULL,
    "email" text DEFAULT NULL,
    "emailVerified" datetime DEFAULT NULL,
    "image" text DEFAULT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "verification_tokens" (
    "identifier" text NOT NULL,
    "token" text NOT NULL DEFAULT NULL,
    "expires" datetime NOT NULL DEFAULT NULL,
    PRIMARY KEY (token)
);
ALTER TABLE users ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN country TEXT;
CREATE UNIQUE INDEX accounts_provider_identity ON accounts(provider, providerAccountId);
CREATE INDEX accounts_user ON accounts(userId);
CREATE INDEX users_email ON users(email);
CREATE INDEX sessions_user ON sessions(userId);
CREATE TABLE user_keys (user_id TEXT PRIMARY KEY REFERENCES users(id), wrapped_dek TEXT NOT NULL);
CREATE TABLE analytics_state (id INTEGER PRIMARY KEY CHECK(id = 1), revision INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0);
INSERT INTO analytics_state(id) VALUES (1);
CREATE TABLE analytics_signins (id TEXT PRIMARY KEY, account TEXT NOT NULL, at INTEGER NOT NULL);
CREATE INDEX analytics_signins_account ON analytics_signins(account, at);
CREATE TABLE analytics_edits (snippet TEXT NOT NULL, account TEXT NOT NULL, language TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY(snippet, at));
CREATE INDEX analytics_edits_account ON analytics_edits(account, at);
CREATE TABLE analytics_snippets (id TEXT PRIMARY KEY, account TEXT NOT NULL, language TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, pinned INTEGER NOT NULL, in_folder INTEGER NOT NULL);
CREATE INDEX analytics_snippets_account ON analytics_snippets(account);
CREATE TABLE analytics_folders (id TEXT PRIMARY KEY, account TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX analytics_folders_account ON analytics_folders(account);
CREATE TABLE deletions (owner_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('folder','snippet')), client_id TEXT NOT NULL, deleted_at INTEGER NOT NULL, PRIMARY KEY(owner_id, kind, client_id));
CREATE INDEX deletions_owner_time ON deletions(owner_id, deleted_at);

CREATE TABLE folders (
 owner_id TEXT NOT NULL REFERENCES users(id), client_id TEXT NOT NULL,
 analytics_id TEXT NOT NULL UNIQUE, data TEXT NOT NULL CHECK(json_valid(data)),
 updated_at TEXT NOT NULL, server_updated_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)),
 PRIMARY KEY(owner_id, client_id), CHECK(length(CAST(data AS BLOB)) <= 1900000)
);
CREATE INDEX folders_owner_time ON folders(owner_id, server_updated_at);

CREATE TABLE snippets (
 owner_id TEXT NOT NULL REFERENCES users(id), client_id TEXT NOT NULL,
 analytics_id TEXT NOT NULL UNIQUE, data TEXT NOT NULL CHECK(json_valid(data)),
 updated_at TEXT NOT NULL, server_updated_at INTEGER NOT NULL DEFAULT (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)),
 PRIMARY KEY(owner_id, client_id), CHECK(length(CAST(data AS BLOB)) <= 1900000)
);
CREATE INDEX snippets_owner_time ON snippets(owner_id, server_updated_at);
CREATE INDEX folders_parent ON folders(owner_id, json_extract(data, '$.parentId'));
CREATE INDEX snippets_folder ON snippets(owner_id, json_extract(data, '$.folderId'));

CREATE TRIGGER folders_cycle_insert AFTER INSERT ON folders BEGIN
 SELECT RAISE(ABORT, 'Folder hierarchy cannot contain cycles') WHERE EXISTS (
  WITH RECURSIVE ancestors(client_id) AS (
   SELECT json_extract(NEW.data, '$.parentId')
   UNION
   SELECT json_extract(f.data, '$.parentId') FROM folders f JOIN ancestors a ON f.client_id = a.client_id WHERE f.owner_id = NEW.owner_id
  ) SELECT 1 FROM ancestors WHERE client_id = NEW.client_id
 );
END;

CREATE TRIGGER folders_cycle_update AFTER UPDATE ON folders BEGIN
 SELECT RAISE(ABORT, 'Folder hierarchy cannot contain cycles') WHERE EXISTS (
  WITH RECURSIVE ancestors(client_id) AS (
   SELECT json_extract(NEW.data, '$.parentId')
   UNION
   SELECT json_extract(f.data, '$.parentId') FROM folders f JOIN ancestors a ON f.client_id = a.client_id WHERE f.owner_id = NEW.owner_id
  ) SELECT 1 FROM ancestors WHERE client_id = NEW.client_id
 );
END;

CREATE TRIGGER folders_analytics_insert AFTER INSERT ON folders BEGIN
 INSERT INTO analytics_folders(id, account, created_at) VALUES (NEW.analytics_id, NEW.owner_id, json_extract(NEW.data, '$.createdAt')) ON CONFLICT(id) DO UPDATE SET created_at=excluded.created_at;
 DELETE FROM deletions WHERE owner_id=NEW.owner_id AND kind='folder' AND client_id=NEW.client_id;
 UPDATE analytics_state SET revision=revision+1, updated_at=CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) WHERE id=1;
END;

CREATE TRIGGER folders_analytics_update AFTER UPDATE ON folders BEGIN
 INSERT INTO analytics_folders(id, account, created_at) VALUES (NEW.analytics_id, NEW.owner_id, json_extract(NEW.data, '$.createdAt')) ON CONFLICT(id) DO UPDATE SET created_at=excluded.created_at;
 DELETE FROM deletions WHERE owner_id=NEW.owner_id AND kind='folder' AND client_id=NEW.client_id;
 UPDATE analytics_state SET revision=revision+1, updated_at=CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) WHERE id=1;
END;

CREATE TRIGGER folders_delete AFTER DELETE ON folders BEGIN
 INSERT INTO deletions(owner_id, kind, client_id, deleted_at) VALUES (OLD.owner_id,'folder',OLD.client_id,CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
 ON CONFLICT(owner_id,kind,client_id) DO UPDATE SET deleted_at=excluded.deleted_at;
 DELETE FROM analytics_folders WHERE id=OLD.analytics_id;
 UPDATE analytics_state SET revision=revision+1, updated_at=CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) WHERE id=1;
END;

CREATE TRIGGER snippets_analytics_insert AFTER INSERT ON snippets BEGIN
 INSERT INTO analytics_snippets(id, account, language, created_at, updated_at, deleted_at, pinned, in_folder)
VALUES (NEW.analytics_id, NEW.owner_id, json_extract(NEW.data,'$.language'), json_extract(NEW.data,'$.createdAt'), json_extract(NEW.data,'$.updatedAt'), json_extract(NEW.data,'$.deletedAt'), json_extract(NEW.data,'$.isPinnedAside') OR json_extract(NEW.data,'$.isPinnedHome'), json_extract(NEW.data,'$.folderId') IS NOT NULL)
ON CONFLICT(id) DO UPDATE SET language=excluded.language, created_at=excluded.created_at, updated_at=excluded.updated_at, deleted_at=excluded.deleted_at, pinned=excluded.pinned, in_folder=excluded.in_folder;
INSERT OR IGNORE INTO analytics_edits(snippet, account, language, at)
SELECT NEW.analytics_id, NEW.owner_id, json_extract(NEW.data,'$.language'), CAST(round((julianday(json_extract(NEW.data,'$.updatedAt'))-2440587.5)*86400000) AS INTEGER)
WHERE (julianday(json_extract(NEW.data,'$.updatedAt'))-julianday(json_extract(NEW.data,'$.createdAt')))*86400000 > 60000
AND (json_extract(NEW.data,'$.deletedAt') IS NULL OR abs((julianday(json_extract(NEW.data,'$.updatedAt'))-julianday(json_extract(NEW.data,'$.deletedAt')))*86400000) >= 5000);
 DELETE FROM deletions WHERE owner_id=NEW.owner_id AND kind='snippet' AND client_id=NEW.client_id;
 UPDATE analytics_state SET revision=revision+1, updated_at=CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) WHERE id=1;
END;

CREATE TRIGGER snippets_analytics_update AFTER UPDATE ON snippets BEGIN
 INSERT INTO analytics_snippets(id, account, language, created_at, updated_at, deleted_at, pinned, in_folder)
VALUES (NEW.analytics_id, NEW.owner_id, json_extract(NEW.data,'$.language'), json_extract(NEW.data,'$.createdAt'), json_extract(NEW.data,'$.updatedAt'), json_extract(NEW.data,'$.deletedAt'), json_extract(NEW.data,'$.isPinnedAside') OR json_extract(NEW.data,'$.isPinnedHome'), json_extract(NEW.data,'$.folderId') IS NOT NULL)
ON CONFLICT(id) DO UPDATE SET language=excluded.language, created_at=excluded.created_at, updated_at=excluded.updated_at, deleted_at=excluded.deleted_at, pinned=excluded.pinned, in_folder=excluded.in_folder;
INSERT OR IGNORE INTO analytics_edits(snippet, account, language, at)
SELECT NEW.analytics_id, NEW.owner_id, json_extract(NEW.data,'$.language'), CAST(round((julianday(json_extract(NEW.data,'$.updatedAt'))-2440587.5)*86400000) AS INTEGER)
WHERE (julianday(json_extract(NEW.data,'$.updatedAt'))-julianday(json_extract(NEW.data,'$.createdAt')))*86400000 > 60000
AND (json_extract(NEW.data,'$.deletedAt') IS NULL OR abs((julianday(json_extract(NEW.data,'$.updatedAt'))-julianday(json_extract(NEW.data,'$.deletedAt')))*86400000) >= 5000);
 DELETE FROM deletions WHERE owner_id=NEW.owner_id AND kind='snippet' AND client_id=NEW.client_id;
 UPDATE analytics_state SET revision=revision+1, updated_at=CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) WHERE id=1;
END;

CREATE TRIGGER snippets_delete AFTER DELETE ON snippets BEGIN
 INSERT INTO deletions(owner_id, kind, client_id, deleted_at) VALUES (OLD.owner_id,'snippet',OLD.client_id,CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
 ON CONFLICT(owner_id,kind,client_id) DO UPDATE SET deleted_at=excluded.deleted_at;
 DELETE FROM analytics_snippets WHERE id=OLD.analytics_id;
 UPDATE analytics_state SET revision=revision+1, updated_at=CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) WHERE id=1;
END;

CREATE TRIGGER folders_detach BEFORE DELETE ON folders BEGIN
 UPDATE snippets SET data=json_set(data,'$.folderId',NULL), server_updated_at=CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
 WHERE owner_id=OLD.owner_id AND json_extract(data,'$.folderId')=OLD.client_id;
END;
CREATE TRIGGER users_created AFTER INSERT ON users BEGIN
 UPDATE users SET created_at=CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) WHERE id=NEW.id AND NEW.created_at=0;
 UPDATE analytics_state SET revision=revision+1, updated_at=CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) WHERE id=1;
END;
CREATE TRIGGER sessions_created AFTER INSERT ON sessions BEGIN
 INSERT OR IGNORE INTO analytics_signins(id,account,at) VALUES(NEW.id,NEW.userId,CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER));
 UPDATE analytics_state SET revision=revision+1, updated_at=CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) WHERE id=1;
END;
CREATE TRIGGER accounts_created AFTER INSERT ON accounts BEGIN
 UPDATE analytics_state SET revision=revision+1, updated_at=CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) WHERE id=1;
END;

CREATE TABLE app_meta(key TEXT PRIMARY KEY, value INTEGER NOT NULL);
INSERT INTO app_meta VALUES('backend_epoch',CAST((julianday('now')-2440587.5)*86400000 AS INTEGER));
