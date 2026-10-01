import type { CloudFolder, CloudSnippet } from "@/lib/types";
import type { CloudChanges } from "@/lib/cloud";

const CLOCK = "CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)";
const RETENTION = 30 * 86400000;
const OVERLAP = 60000;
export class InputError extends Error {}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new InputError("Invalid record");
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 1900000): string {
  if (typeof value !== "string" || value.length > max)
    throw new InputError("Invalid string");
  return value;
}
function id(value: unknown): string {
  const s = text(value, 128);
  if (!s) throw new InputError("Invalid id");
  return s;
}
function nullableId(value: unknown): string | null {
  return value === null ? null : id(value);
}
function date(value: unknown): string {
  const s = text(value, 40);
  // Imported Supabase records retain ISO offsets and variable fractional
  // precision. Preserve their timestamps while accepting both UTC spellings.
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(s) ||
    !Number.isFinite(Date.parse(s))
  )
    throw new InputError("Invalid timestamp");
  return s;
}
function bool(value: unknown): boolean {
  if (typeof value !== "boolean") throw new InputError("Invalid boolean");
  return value;
}
function record(
  value: unknown,
  kind: "folder" | "snippet",
): CloudFolder | CloudSnippet {
  const v = object(value);
  if (!Number.isSafeInteger(v.cryptoVersion) || Number(v.cryptoVersion) < 0)
    throw new InputError("Invalid encryption version");
  const common = {
    clientId: id(v.clientId),
    createdAt: date(v.createdAt),
    updatedAt: date(v.updatedAt),
    deletedAt: v.deletedAt === null ? null : date(v.deletedAt),
    isPinnedAside: bool(v.isPinnedAside),
    isPinnedHome: bool(v.isPinnedHome),
    cryptoVersion: Number(v.cryptoVersion),
  };
  const result =
    kind === "folder"
      ? { ...common, name: text(v.name), parentId: nullableId(v.parentId) }
      : {
          ...common,
          title: text(v.title),
          code: text(v.code),
          language: text(v.language, 128),
          folderId: nullableId(v.folderId),
        };
  if (new TextEncoder().encode(JSON.stringify(result)).length > 1900000)
    throw new InputError("Record exceeds storage limit");
  return result;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length > 500)
    throw new InputError("Invalid batch");
  return value;
}

/** Each write uses the owner/client primary key. The batch and triggers are atomic. */
export async function pushWorkspace(
  db: D1Database,
  owner: string,
  body: unknown,
): Promise<void> {
  const v = object(body);
  const folders = array(v.folders).map(
    (x) => record(x, "folder") as CloudFolder,
  );
  const snippets = array(v.snippets).map(
    (x) => record(x, "snippet") as CloudSnippet,
  );
  if (folders.length + snippets.length > 500)
    throw new InputError("Batch exceeds 500 records");
  const statements: D1PreparedStatement[] = folders.map((f) =>
    db
      .prepare(
        `INSERT INTO folders(owner_id,client_id,analytics_id,data,updated_at,server_updated_at)
    VALUES(?,?,?,?,?,${CLOCK}) ON CONFLICT(owner_id,client_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at,server_updated_at=excluded.server_updated_at
    WHERE julianday(excluded.updated_at)>=julianday(folders.updated_at) AND excluded.data<>folders.data`,
      )
      .bind(
        owner,
        f.clientId,
        crypto.randomUUID(),
        JSON.stringify(f),
        f.updatedAt,
      ),
  );
  // Check missing parents only after all folders in this request exist.
  if (folders.length)
    statements.push(
      db
        .prepare(
          `UPDATE folders SET data=json_set(data,'$.parentId',NULL),server_updated_at=${CLOCK}
    WHERE owner_id=? AND client_id IN (SELECT value FROM json_each(?)) AND json_extract(data,'$.parentId') IS NOT NULL
    AND NOT EXISTS(SELECT 1 FROM folders parent WHERE parent.owner_id=folders.owner_id AND parent.client_id=json_extract(folders.data,'$.parentId'))`,
        )
        .bind(owner, JSON.stringify(folders.map((f) => f.clientId))),
    );
  for (const s of snippets)
    statements.push(
      db
        .prepare(
          `INSERT INTO snippets(owner_id,client_id,analytics_id,data,updated_at,server_updated_at)
    VALUES(?,?,?,json_set(?,'$.folderId',CASE WHEN EXISTS(SELECT 1 FROM folders WHERE owner_id=? AND client_id=?) THEN ? ELSE NULL END),?,${CLOCK})
    ON CONFLICT(owner_id,client_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at,server_updated_at=excluded.server_updated_at
    WHERE julianday(excluded.updated_at)>=julianday(snippets.updated_at) AND excluded.data<>snippets.data`,
        )
        .bind(
          owner,
          s.clientId,
          crypto.randomUUID(),
          JSON.stringify(s),
          owner,
          s.folderId,
          s.folderId,
          s.updatedAt,
        ),
    );
  if (statements.length) await db.batch(statements);
}

export async function removeWorkspace(
  db: D1Database,
  owner: string,
  body: unknown,
): Promise<void> {
  const v = object(body);
  const folderIds = array(v.folderIds).map(id);
  const snippetIds = array(v.snippetIds).map(id);
  await db.batch([
    db
      .prepare(
        "DELETE FROM snippets WHERE owner_id=? AND client_id IN (SELECT value FROM json_each(?))",
      )
      .bind(owner, JSON.stringify(snippetIds)),
    db
      .prepare(
        `WITH RECURSIVE doomed(id) AS (
      SELECT client_id FROM folders WHERE owner_id=? AND client_id IN (SELECT value FROM json_each(?))
      UNION SELECT f.client_id FROM folders f JOIN doomed d ON json_extract(f.data,'$.parentId')=d.id WHERE f.owner_id=?
    ) DELETE FROM folders WHERE owner_id=? AND client_id IN (SELECT id FROM doomed)`,
      )
      .bind(owner, JSON.stringify(folderIds), owner, owner),
    db
      .prepare("DELETE FROM deletions WHERE owner_id=? AND deleted_at<?")
      .bind(owner, Date.now() - RETENTION),
  ]);
}

export async function workspaceChanges(
  db: D1Database,
  owner: string,
  since: unknown,
): Promise<CloudChanges> {
  if (since !== null && (!Number.isSafeInteger(since) || Number(since) < 0))
    throw new InputError("Invalid cursor");
  const epoch = await db
    .prepare("SELECT value FROM app_meta WHERE key='backend_epoch'")
    .first<number>("value");
  const now = Date.now();
  const full =
    since === null ||
    Number(since) < Math.max(now - RETENTION, Number(epoch ?? 0)) ||
    Number(since) > now;
  const lower = Number(since) - OVERLAP;
  const results = await db.batch([
    db.prepare(`SELECT ${CLOCK} AS cursor`),
    db
      .prepare(
        `SELECT data FROM folders WHERE owner_id=?${full ? "" : " AND server_updated_at>=?"}`,
      )
      .bind(...(full ? [owner] : [owner, lower])),
    db
      .prepare(
        `SELECT data FROM snippets WHERE owner_id=?${full ? "" : " AND server_updated_at>=?"}`,
      )
      .bind(...(full ? [owner] : [owner, lower])),
    db
      .prepare(
        "SELECT kind,client_id FROM deletions WHERE owner_id=? AND deleted_at>=?",
      )
      .bind(owner, full ? now : lower),
  ]);
  const deleted = results[3].results as { kind: string; client_id: string }[];
  return {
    full,
    cursor: Number((results[0].results[0] as { cursor: number }).cursor),
    folders: (results[1].results as { data: string }[]).map((x) =>
      JSON.parse(x.data),
    ),
    snippets: (results[2].results as { data: string }[]).map((x) =>
      JSON.parse(x.data),
    ),
    deletedFolderIds: deleted
      .filter((x) => x.kind === "folder")
      .map((x) => x.client_id),
    deletedSnippetIds: deleted
      .filter((x) => x.kind === "snippet")
      .map((x) => x.client_id),
  };
}
export async function hasWorkspaceContent(
  db: D1Database,
  owner: string,
): Promise<boolean> {
  const row = await db
    .prepare(
      "SELECT EXISTS(SELECT 1 FROM folders WHERE owner_id=? LIMIT 1) OR EXISTS(SELECT 1 FROM snippets WHERE owner_id=? LIMIT 1) AS present",
    )
    .bind(owner, owner)
    .first<{ present: number }>();
  return Boolean(row?.present);
}
