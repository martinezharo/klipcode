import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getDirtyWorkspace } from "@/lib/db";
import { fetchCloudWorkspace, syncDirtyWorkspace } from "@/lib/sync";
import type { Dictionary } from "@/i18n";
import type { SyncStatus } from "@/lib/types";
import { DEBOUNCE_MS } from "@/lib/constants/timing";

interface UseCloudSyncOptions {
  user: User | null;
  supabaseConfigured: boolean;
  copy: Dictionary;
  refreshWorkspace: () => void;
  setAccountMessage: (msg: string) => void;
}

export function useCloudSync({
  user,
  supabaseConfigured,
  copy,
  refreshWorkspace,
  setAccountMessage,
}: UseCloudSyncOptions) {
  const [snippetStatuses, setSnippetStatuses] = useState<Record<string, SyncStatus>>({});

  const localStatusTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const cloudSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudSyncInFlightRef = useRef(false);

  // Refs for stable access inside async callbacks
  const userRef = useRef(user);
  userRef.current = user;
  const refreshRef = useRef(refreshWorkspace);
  refreshRef.current = refreshWorkspace;
  const setAccountMessageRef = useRef(setAccountMessage);
  setAccountMessageRef.current = setAccountMessage;
  const copyRef = useRef(copy);
  copyRef.current = copy;

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
    if (!currentUser || !supabaseConfigured || cloudSyncInFlightRef.current) return;

    cloudSyncInFlightRef.current = true;

    try {
      const dirtyWorkspace = await getDirtyWorkspace(currentUser.id);

      if (dirtyWorkspace.folders.length === 0 && dirtyWorkspace.snippets.length === 0) return;

      for (const snippet of dirtyWorkspace.snippets) {
        setSnippetStatus(snippet.id, "saving");
      }

      setAccountMessageRef.current(copyRef.current.auth.cloudSyncRunning);
      const result = await syncDirtyWorkspace(currentUser.id);
      await fetchCloudWorkspace(currentUser.id);
      refreshRef.current();

      for (const snippetId of result.syncedSnippetIds) {
        setSnippetStatus(snippetId, "saved-cloud");
      }

      setAccountMessageRef.current(copyRef.current.auth.syncedSession);
    } catch {
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

      const finalUser = userRef.current;
      if (finalUser) {
        const dirtyWorkspace = await getDirtyWorkspace(finalUser.id);

        if (dirtyWorkspace.folders.length > 0 || dirtyWorkspace.snippets.length > 0) {
          if (cloudSyncTimerRef.current) clearTimeout(cloudSyncTimerRef.current);
          cloudSyncTimerRef.current = setTimeout(() => {
            void runCloudSync();
          }, DEBOUNCE_MS);
        }
      }
    }
  }

  function scheduleCloudSync() {
    if (!userRef.current || !supabaseConfigured) return;

    if (cloudSyncTimerRef.current) clearTimeout(cloudSyncTimerRef.current);

    cloudSyncTimerRef.current = setTimeout(() => {
      void runCloudSync();
    }, DEBOUNCE_MS);
  }

  // Cleanup sync timers on unmount
  useEffect(() => {
    const localTimers = localStatusTimersRef.current;
    return () => {
      if (cloudSyncTimerRef.current) clearTimeout(cloudSyncTimerRef.current);
      for (const timer of localTimers.values()) clearTimeout(timer);
    };
  }, []);

  return { snippetStatuses, setSnippetStatus, settleLocally, scheduleCloudSync };
}
