import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ── Identity of a synced record ─────────────────────────────────────────────
// The client mints a UUID for every folder/snippet and stores it in IndexedDB as
// the primary key. That id is what the whole app (selection, routing, drag,
// tombstones) is built on, so it stays authoritative here too: `clientId` is the
// real key, and Convex's own `_id` is an implementation detail the client never
// sees. Every lookup goes through the `by_owner_client` index, which also makes
// the "one record per (owner, id)" uniqueness the old `(owner_id, id)` unique
// constraint gave us cheap to enforce in a mutation.

const syncedFields = {
  clientId: v.string(),
  ownerId: v.id("users"),
  isPinnedAside: v.boolean(),
  isPinnedHome: v.boolean(),
  /** ISO-8601, minted by the client. See the note on `updatedAt` below. */
  createdAt: v.string(),
  /**
   * ISO-8601, minted by the client and never overwritten server-side.
   *
   * The client authors this comparison key for last-write-wins during sync.
   * Stamping it with server time here would mix client and server clocks and
   * silently drop newer edits
   * under clock skew. (This is the same reason the Postgres schema deliberately
   * had no `set_updated_at` trigger on these tables.)
   */
  updatedAt: v.string(),
  /** Synced soft delete: `null` = live, a timestamp = in the trash. */
  deletedAt: v.union(v.string(), v.null()),
  /**
   * Encryption scheme applied to this record's sensitive fields: 0 = plaintext
   * (encryption unavailable), 1 = AES-256-GCM via the per-user DEK
   * (`src/lib/crypto.ts`). Records migrate progressively: every upload writes
   * the current version, so a record is re-encoded when created or edited.
   */
  cryptoVersion: v.number(),
  /**
   * Server clock (ms) of the last write, stamped by the backend on every insert
   * and patch. This, not the client-authored `updatedAt`, is the incremental
   * sync cursor: it only moves forward, whatever the device clocks say. Absent
   * on rows last written before incremental sync existed; those are delivered
   * by the full pull every device does once before it holds a cursor.
   */
  serverUpdatedAt: v.optional(v.number()),
};

export default defineSchema({
  ...authTables,

  folders: defineTable({
    ...syncedFields,
    /** Ciphertext when `cryptoVersion` > 0, plaintext when 0. */
    name: v.string(),
    /** `clientId` of the parent folder, not a Convex id. */
    parentId: v.union(v.string(), v.null()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_owner_client", ["ownerId", "clientId"])
    .index("by_owner_parent", ["ownerId", "parentId"])
    .index("by_owner_server_updated", ["ownerId", "serverUpdatedAt"])
    .index("by_server_updated", ["serverUpdatedAt"]),

  snippets: defineTable({
    ...syncedFields,
    /** Ciphertext when `cryptoVersion` > 0, plaintext when 0. */
    title: v.string(),
    /** Ciphertext when `cryptoVersion` > 0, plaintext when 0. */
    code: v.string(),
    /** Always plaintext: not sensitive, and used for filtering. */
    language: v.string(),
    /** `clientId` of the containing folder, not a Convex id. */
    folderId: v.union(v.string(), v.null()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_owner_client", ["ownerId", "clientId"])
    .index("by_owner_folder", ["ownerId", "folderId"])
    .index("by_owner_server_updated", ["ownerId", "serverUpdatedAt"])
    .index("by_server_updated", ["serverUpdatedAt"]),

  // Permanent deletions, so an incremental pull can tell devices what to drop:
  // a deleted row is gone and would otherwise simply stop appearing. Kept for
  // `DELETION_RETENTION_MS` (convex/lib/syncCursor.ts); a device whose cursor
  // is older than that falls back to a full pull, which needs no log.
  deletions: defineTable({
    ownerId: v.id("users"),
    kind: v.union(v.literal("folder"), v.literal("snippet")),
    clientId: v.string(),
    /** Convex id of the deleted row, so analytics can drop its anonymised copy. */
    docId: v.string(),
    /** Server clock (ms), comparable with `serverUpdatedAt`. */
    deletedAt: v.number(),
  })
    .index("by_owner_deleted", ["ownerId", "deletedAt"])
    .index("by_deleted", ["deletedAt"]),

  // Per-user data-encryption key, stored ALWAYS wrapped (AES-256-GCM) by the
  // master key `ENCRYPTION_MASTER_KEY`, which lives only as a Cloudflare Worker
  // secret and never reaches Convex. Without that master key this table cannot
  // decrypt anything: an export of this deployment contains only ciphertext.
  // `/api/crypto/dek` (on Cloudflare) is the single place where the DEK and the
  // master key meet. There is deliberately no update or delete: a user's DEK is
  // immutable once created, since dropping it would orphan every encrypted
  // record.
  userKeys: defineTable({
    userId: v.id("users"),
    wrappedDek: v.string(),
  }).index("by_user", ["userId"]),
});
