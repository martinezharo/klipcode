"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import {
  startTransition,
  useEffect,
  useRef,
  useState,
} from "react";

import { db, getDirtyWorkspace, readWorkspace } from "@/lib/db";
import { fetchCloudWorkspace, reconcileWorkspace, syncDirtyWorkspace } from "@/lib/sync";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import type { FolderRecord, SyncStatus } from "@/lib/types";
import { getDictionary } from "@/i18n";

import { Header } from "@/components/Header/Header";
import { Aside } from "@/components/Aside/Aside";
import { NewSnippet } from "@/components/NewSnippet/NewSnippet";
import { RecentSnippets } from "@/components/RecentSnippets/RecentSnippets";
import { SnippetEditor } from "@/components/SnippetEditor/SnippetEditor";

interface FolderOption {
  value: string;
  label: string;
}

function buildFolderOptions(
  folders: FolderRecord[],
  rootLabel: string,
  parentId: string | null = null,
  prefix = ""
): FolderOption[] {
  const currentFolders = folders.filter((folder) => folder.parentId === parentId);
  const options = parentId === null ? [{ value: "", label: rootLabel }] : [];

  for (const folder of currentFolders) {
    const currentLabel = prefix ? `${prefix} / ${folder.name}` : folder.name;
    options.push({ value: folder.id, label: currentLabel });
    options.push(...buildFolderOptions(folders, rootLabel, folder.id, currentLabel));
  }

  return options;
}

export default function KodeBoardApp() {
  const copy = getDictionary();
  const queryClient = useQueryClient();
  const supabase = getSupabaseBrowserClient();
  const supabaseConfigured = isSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [accountMessage, setAccountMessage] = useState<string>(
    supabaseConfigured ? copy.auth.localMode : copy.auth.notConfigured
  );
  const [snippetStatuses, setSnippetStatuses] = useState<Record<string, SyncStatus>>({});
  const [selectedSnippetId, setSelectedSnippetId] = useState<string | null>(null);
  const localStatusTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const updateTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const cloudSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudSyncInFlightRef = useRef(false);
  const accountSyncInFlightRef = useRef(false);

  const workspaceQuery = useQuery({
    queryKey: ["workspace", user?.id ?? "guest"],
    queryFn: () => readWorkspace(user?.id ?? null),
  });

  function refreshWorkspace() {
    startTransition(() => {
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "workspace",
      });
    });
  }

  function setSnippetStatus(snippetId: string, status: SyncStatus) {
    setSnippetStatuses((currentStatuses) => ({
      ...currentStatuses,
      [snippetId]: status,
    }));
  }

  function settleLocally(snippetId: string) {
    const currentTimer = localStatusTimersRef.current.get(snippetId);

    if (currentTimer) {
      clearTimeout(currentTimer);
    }

    const nextTimer = setTimeout(() => {
      setSnippetStatus(snippetId, "saved-local");
      localStatusTimersRef.current.delete(snippetId);
    }, 800);

    localStatusTimersRef.current.set(snippetId, nextTimer);
  }

  async function runCloudSync() {
    if (!user || !supabaseConfigured || cloudSyncInFlightRef.current) {
      return;
    }

    cloudSyncInFlightRef.current = true;

    try {
      const dirtyWorkspace = await getDirtyWorkspace(user.id);

      if (dirtyWorkspace.folders.length === 0 && dirtyWorkspace.snippets.length === 0) {
        return;
      }

      for (const snippet of dirtyWorkspace.snippets) {
        setSnippetStatus(snippet.id, "saving");
      }

      setAccountMessage(copy.auth.cloudSyncRunning);
      const result = await syncDirtyWorkspace(user.id);
      await fetchCloudWorkspace(user.id);
      refreshWorkspace();

      for (const snippetId of result.syncedSnippetIds) {
        setSnippetStatus(snippetId, "saved-cloud");
      }

      setAccountMessage(copy.auth.syncedSession);
    } catch {
      const dirtyWorkspace = await getDirtyWorkspace(user.id);

      for (const snippet of dirtyWorkspace.snippets) {
        setSnippetStatus(snippet.id, "error");
      }

      setAccountMessage(copy.auth.syncFailed);
    } finally {
      cloudSyncInFlightRef.current = false;

      const dirtyWorkspace = await getDirtyWorkspace(user.id);

      if (dirtyWorkspace.folders.length > 0 || dirtyWorkspace.snippets.length > 0) {
        if (cloudSyncTimerRef.current) {
          clearTimeout(cloudSyncTimerRef.current);
        }

        cloudSyncTimerRef.current = setTimeout(() => {
          void runCloudSync();
        }, 800);
      }
    }
  }

  function scheduleCloudSync() {
    if (!user || !supabaseConfigured) {
      return;
    }

    if (cloudSyncTimerRef.current) {
      clearTimeout(cloudSyncTimerRef.current);
    }

    cloudSyncTimerRef.current = setTimeout(() => {
      void runCloudSync();
    }, 800);
  }

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    let mounted = true;

    function refreshWorkspaceView() {
      startTransition(() => {
        void queryClient.invalidateQueries({
          predicate: (query) => query.queryKey[0] === "workspace",
        });
      });
    }

    async function syncAccount(nextUser: User) {
      if (!supabaseConfigured || accountSyncInFlightRef.current) {
        return;
      }

      accountSyncInFlightRef.current = true;
      setAccountMessage(copy.auth.syncingSession);

      try {
        const result = await reconcileWorkspace(nextUser.id);

        refreshWorkspaceView();

        for (const snippetId of result.syncedSnippetIds) {
          setSnippetStatus(snippetId, "saved-cloud");
        }

        setAccountMessage(copy.auth.syncedSession);
      } catch {
        setAccountMessage(copy.auth.syncFailed);
      } finally {
        accountSyncInFlightRef.current = false;
      }
    }

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) {
        return;
      }

      const nextUser = data.session?.user ?? null;
      setUser(nextUser);
      setAuthReady(true);

      if (nextUser) {
        setAccountMessage(copy.auth.signedIn);
        void syncAccount(nextUser);
      } else if (supabaseConfigured) {
        setAccountMessage(copy.auth.localMode);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      setAuthReady(true);

      if (nextUser) {
        setAccountMessage(copy.auth.signedIn);
        void syncAccount(nextUser);
        return;
      }

      setAccountMessage(supabaseConfigured ? copy.auth.localMode : copy.auth.notConfigured);
      refreshWorkspaceView();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [
    copy.auth.localMode,
    copy.auth.notConfigured,
    copy.auth.signedIn,
    copy.auth.syncFailed,
    copy.auth.syncedSession,
    copy.auth.syncingSession,
    queryClient,
    supabase,
    supabaseConfigured,
  ]);

  useEffect(() => {
    const localStatusTimers = localStatusTimersRef.current;
    const updateTimers = updateTimersRef.current;

    return () => {
      if (cloudSyncTimerRef.current) {
        clearTimeout(cloudSyncTimerRef.current);
      }

      for (const timer of localStatusTimers.values()) {
        clearTimeout(timer);
      }

      for (const timer of updateTimers.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  async function handleGitHubSignIn() {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      setAccountMessage(copy.auth.syncFailed);
    }
  }

  async function handleSignOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setUser(null);
    setAccountMessage(supabaseConfigured ? copy.auth.localMode : copy.auth.notConfigured);
    refreshWorkspace();
  }

  async function handleCreateSnippet(data: {
    title: string;
    language: string;
    folderId: string;
    code: string;
  }) {
    if (!data.code.trim()) {
      return;
    }

    const snippetId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    await db.snippets.put({
      id: snippetId,
      ownerId: user?.id ?? null,
      folderId: data.folderId || null,
      title: data.title.trim() || "Untitled",
      language: data.language.trim(),
      code: data.code,
      isPinned: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      dirty: true,
      lastSyncedAt: null,
    });

    setSnippetStatuses((currentStatuses) => ({
      ...currentStatuses,
      [snippetId]: "editing",
    }));

    refreshWorkspace();

    if (user && supabaseConfigured) {
      scheduleCloudSync();
      return;
    }

    settleLocally(snippetId);
  }

  async function handleUpdateSnippet(
    snippetId: string,
    changes: { title?: string; code?: string }
  ) {
    setSnippetStatus(snippetId, "editing");

    const existing = updateTimersRef.current.get(snippetId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      updateTimersRef.current.delete(snippetId);

      await db.snippets.update(snippetId, {
        ...changes,
        updatedAt: new Date().toISOString(),
        dirty: true,
      });

      refreshWorkspace();

      if (user && supabaseConfigured) {
        scheduleCloudSync();
      } else {
        settleLocally(snippetId);
      }
    }, 800);

    updateTimersRef.current.set(snippetId, timer);
  }

  const folders = workspaceQuery.data?.folders ?? [];
  const snippets = workspaceQuery.data?.snippets ?? [];
  const folderOptions = buildFolderOptions(folders, copy.workspace.rootOption);

  const selectedSnippet = selectedSnippetId
    ? (snippets.find((s) => s.id === selectedSnippetId) ?? null)
    : null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Aside
        folders={folders}
        snippets={snippets}
        copy={copy}
        onSelectSnippet={setSelectedSnippetId}
        onGoHome={() => setSelectedSnippetId(null)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          user={user}
          authReady={authReady}
          supabaseConfigured={supabaseConfigured}
          copy={copy}
          onSignIn={handleGitHubSignIn}
          onSignOut={handleSignOut}
        />

        {selectedSnippet ? (
          <div className="flex-1 overflow-hidden">
            <SnippetEditor
              key={selectedSnippet.id}
              snippet={selectedSnippet}
              folders={folders}
              copy={copy}
              syncStatus={snippetStatuses[selectedSnippet.id] ?? "idle"}
              onClose={() => setSelectedSnippetId(null)}
              onUpdate={handleUpdateSnippet}
            />
          </div>
        ) : (
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-8">
              <NewSnippet
                copy={copy}
                folderOptions={folderOptions}
                onCreateSnippet={handleCreateSnippet}
              />

              <RecentSnippets
                snippets={snippets}
                folders={folders}
                copy={copy}
                onSelectSnippet={setSelectedSnippetId}
              />
            </div>
          </main>
        )}
      </div>
    </div>
  );
}