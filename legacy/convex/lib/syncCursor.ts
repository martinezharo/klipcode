/**
 * Incremental sync works on the server clock: every write stamps
 * `serverUpdatedAt` (and every permanent delete logs a `deletions` row) with
 * `Date.now()` inside its mutation, and a reader asks for everything at or
 * after the cursor it was handed last time.
 *
 * `Date.now()` is fixed when a mutation starts, not when it commits, so a
 * mutation that was still running while a reader took its cursor can land
 * slightly *behind* that cursor. Every read therefore reaches back
 * `SYNC_OVERLAP_MS`. Mutations are capped at seconds, so a minute is ample;
 * the cost is re-reading only what changed in that last minute, which the
 * client applies idempotently.
 */
export const SYNC_OVERLAP_MS = 60_000;

/**
 * How long permanent deletions are remembered. A reader whose cursor is older
 * than this can no longer trust the log to be complete, so it is sent the whole
 * workspace instead (the same full pull a new device does).
 */
export const DELETION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Where an incremental read starts for a cursor handed out earlier. */
export function readFrom(cursor: number): number {
  return cursor - SYNC_OVERLAP_MS;
}

/** Whether a cursor is too old for the deletion log, so only a full read is safe. */
export function isCursorExpired(cursor: number, now: number): boolean {
  return cursor < now - DELETION_RETENTION_MS;
}
