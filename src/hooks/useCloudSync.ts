import { useEffect, useRef, useState } from "react";
import type { AccountUser } from "@/lib/types";
import { useLatestRef } from "@/hooks/useLatestRef";
import { getDirtyWorkspace, getPendingTombstones } from "@/lib/db";
import { fetchCloudWorkspace, syncDirtyWorkspace, syncTombstones } from "@/lib/sync";
import type { Dictionary } from "@/i18n";
import type { SyncResult, SyncStatus } from "@/lib/types";
import { DEBOUNCE_MS } from "@/lib/constants/timing";

const MAX_SYNC_ERRORS = 5;
const MAX_SYNC_BACKOFF_MS = 30_000;

/**
 * Delay before the next retry. With no errors it's the normal debounce; after a
 * failure it backs off exponentially (capped) so we don't hammer an unreachable
 * cloud every debounce tick.
 */
function getRetryDelay(errorCount: number): number {
  if (errorCount <= 0) return DEBOUNCE_MS;
  return Math.min(DEBOUNCE_MS * 2 ** (errorCount - 1), MAX_SYNC_BACKOFF_MS);
}

interface UseCloudSyncOptions {
  user: AccountUser | null;
  cloudConfigured: boolean;
  copy: Dictionary;
  refreshWorkspace: () => void;
  setAccountMessage: (msg: string) => void;
}

export function useCloudSync({
  user,
  cloudConfigured,
  copy,
  refreshWorkspace,
  setAccountMessage,
}: UseCloudSyncOptions) {
  const [snippetStatuses, setSnippetStatuses] = useState<Record<string, SyncStatus>>({});

  const localStatusTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const cloudSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudSyncInFlightRef = useRef(false);
  const syncErrorCountRef = useRef(0);

  // Refs for stable access inside async callbacks
  const userRef = useLatestRef(user);
  const refreshRef = useLatestRef(refreshWorkspace);
  const setAccountMessageRef = useLatestRef(setAccountMessage);
  const copyRef = useLatestRef(copy);

  function setSnippetStatus(snippetId: string, status: SyncStatus) {
    setSnippetStatuses((prev) => ({ ...prev, [snippetId]: status }));
  }

  function settleLocally(snippetId: string) {
    const currentTimer = localStatusTimersRef.current.get(snippetId);
    if (currentTimer) clearTimeout(currentTimer);

    const nextTimer = setTimeout(() => {
      setSnippetStatus(snippetId, "saved-local");
      localStatusTimersRef.current.delete(snippetId);
    }, DEBOUNCE_MS);

    localStatusTimersRef.current.set(snippetId, nextTimer);
  }

  async function runCloudSync() {
    const currentUser = userRef.current;
    if (!currentUser || !cloudConfigured || cloudSyncInFlightRef.current) return;

    cloudSyncInFlightRef.current = true;
    let syncSucceeded = false;
    let syncResult: SyncResult | null = null;

    try {
      const dirtyWorkspace = await getDirtyWorkspace(currentUser.id);
      const pendingTombstones = await getPendingTombstones(currentUser.id);

      if (
        dirtyWorkspace.folders.length === 0 &&
        dirtyWorkspace.snippets.length === 0 &&
        pendingTombstones.length === 0
      ) {
        syncSucceeded = true;
        return;
      }

      for (const snippet of dirtyWorkspace.snippets) {
        setSnippetStatus(snippet.id, "saving");
      }

      setAccountMessageRef.current(copyRef.current.auth.cloudSyncRunning);
      syncResult = await syncDirtyWorkspace(currentUser.id);
      await syncTombstones(currentUser.id);
      await fetchCloudWorkspace(currentUser.id);
      refreshRef.current();

      for (const snippetId of syncResult.syncedSnippetIds) {
        setSnippetStatus(snippetId, "saved-cloud");
      }

      for (const snippetId of syncResult.localSnippetIds) {
        settleLocally(snippetId);
      }

      setAccountMessageRef.current(copyRef.current.auth.syncedSession);
      syncSucceeded = true;
      syncErrorCountRef.current = 0;
    } catch {
      syncErrorCountRef.current++;

      // If syncDirtyWorkspace succeeded before the error, mark those snippets as saved.
      if (syncResult) {
        for (const snippetId of syncResult.syncedSnippetIds) {
          setSnippetStatus(snippetId, "saved-cloud");
        }
        for (const snippetId of syncResult.localSnippetIds) {
          settleLocally(snippetId);
        }
      }

      const dirtyUser = userRef.current;
      if (dirtyUser) {
        const dirtyWorkspace = await getDirtyWorkspace(dirtyUser.id);
        for (const snippet of dirtyWorkspace.snippets) {
          setSnippetStatus(snippet.id, "error");
        }
      }

      setAccountMessageRef.current(copyRef.current.auth.syncFailed);
    } finally {
      cloudSyncInFlightRef.current = false;

      // Stop automatic retries after too many consecutive errors to prevent
      // an infinite save loop when the cloud is unreachable or auth has expired.
      if (!syncSucceeded && syncErrorCountRef.current >= MAX_SYNC_ERRORS) return;

      const finalUser = userRef.current;
      if (finalUser) {
        const dirtyWorkspace = await getDirtyWorkspace(finalUser.id);
        const pendingTombstones = await getPendingTombstones(finalUser.id);

        if (
          dirtyWorkspace.folders.length > 0 ||
          dirtyWorkspace.snippets.length > 0 ||
          pendingTombstones.length > 0
        ) {
          if (cloudSyncTimerRef.current) clearTimeout(cloudSyncTimerRef.current);
          cloudSyncTimerRef.current = setTimeout(() => {
            void runCloudSync();
          }, getRetryDelay(syncErrorCountRef.current));
        }
      }
    }
  }

  /**
   * Pull-only refresh. `runCloudSync` skips the cloud fetch when there are no
   * local changes, so without this a session never sees edits made on another
   * device. Triggered on reconnect / tab focus to surface remote changes.
   */
  async function runCloudPull() {
    const currentUser = userRef.current;
    if (!currentUser || !cloudConfigured || cloudSyncInFlightRef.current) return;

    cloudSyncInFlightRef.current = true;
    try {
      await fetchCloudWorkspace(currentUser.id);
      refreshRef.current();
    } catch {
      // Best-effort: a failed pull is retried on the next focus/online event.
    } finally {
      cloudSyncInFlightRef.current = false;
    }
  }

  const runCloudPullRef = useLatestRef(runCloudPull);

  function scheduleCloudSync() {
    if (!userRef.current || !cloudConfigured) return;

    // Reset error count so a new user edit always triggers a fresh sync attempt.
    syncErrorCountRef.current = 0;

    if (cloudSyncTimerRef.current) clearTimeout(cloudSyncTimerRef.current);

    cloudSyncTimerRef.current = setTimeout(() => {
      void runCloudSync();
    }, DEBOUNCE_MS);
  }

  // Stable ref so the reconnect listeners below always call the latest closure.
  const scheduleCloudSyncRef = useLatestRef(scheduleCloudSync);

  // Flush whatever this device still owes the cloud as soon as an account is
  // known. Without this the loop is driven only by user edits and by
  // focus/online events, so a page that is loaded and simply left alone keeps
  // its pending work forever — which is exactly what stranded the records
  // adopted from the pre-Convex backend, since adoption marks them dirty
  // without the user touching anything.
  useEffect(() => {
    if (!user || !cloudConfigured) return;

    let cancelled = false;

    void (async () => {
      const [dirtyWorkspace, pendingTombstones] = await Promise.all([
        getDirtyWorkspace(user.id),
        getPendingTombstones(user.id),
      ]);

      if (cancelled) return;

      if (
        dirtyWorkspace.folders.length > 0 ||
        dirtyWorkspace.snippets.length > 0 ||
        pendingTombstones.length > 0
      ) {
        scheduleCloudSyncRef.current();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cloudConfigured, user, scheduleCloudSyncRef]);

  // Cleanup sync timers on unmount
  useEffect(() => {
    const localTimers = localStatusTimersRef.current;
    return () => {
      if (cloudSyncTimerRef.current) clearTimeout(cloudSyncTimerRef.current);
      for (const timer of localTimers.values()) clearTimeout(timer);
    };
  }, []);

  // Resume syncing when connectivity returns or the tab becomes visible. This
  // restarts the loop even after it gave up at MAX_SYNC_ERRORS, and clears the
  // backoff so the retry is immediate. `scheduleCloudSync` no-ops when there's
  // nothing to sync or no signed-in user.
  useEffect(() => {
    if (!cloudConfigured) return;

    function resume() {
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      syncErrorCountRef.current = 0;
      // Push any pending local edits and pull remote changes made elsewhere.
      scheduleCloudSyncRef.current();
      void runCloudPullRef.current();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") resume();
    }

    window.addEventListener("online", resume);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("online", resume);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [cloudConfigured, runCloudPullRef, scheduleCloudSyncRef]);

  return { snippetStatuses, setSnippetStatus, settleLocally, scheduleCloudSync };
}
