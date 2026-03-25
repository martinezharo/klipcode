"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import {
  type ChangeEvent,
  type FormEvent,
  startTransition,
  useEffect,
  useRef,
  useState,
} from "react";

import { db, getDirtyWorkspace, readWorkspace } from "@/lib/db";
import { fetchCloudWorkspace, reconcileWorkspace, syncDirtyWorkspace } from "@/lib/sync";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import type { FolderRecord, SnippetRecord, SyncStatus } from "@/lib/types";
import { getDictionary, type Dictionary } from "@/i18n";

interface FolderOption {
  value: string;
  label: string;
}

interface FolderFormState {
  name: string;
  parentId: string;
  isPinned: boolean;
}

interface SnippetFormState {
  title: string;
  language: string;
  folderId: string;
  isPinned: boolean;
  code: string;
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

function groupFoldersByParent(folders: FolderRecord[]) {
  const foldersByParent = new Map<string | null, FolderRecord[]>();

  for (const folder of folders) {
    const list = foldersByParent.get(folder.parentId) ?? [];
    list.push(folder);
    foldersByParent.set(folder.parentId, list);
  }

  return foldersByParent;
}

function groupSnippetsByFolder(snippets: SnippetRecord[]) {
  const snippetsByFolder = new Map<string | null, SnippetRecord[]>();

  for (const snippet of snippets) {
    const list = snippetsByFolder.get(snippet.folderId) ?? [];
    list.push(snippet);
    snippetsByFolder.set(snippet.folderId, list);
  }

  return snippetsByFolder;
}

function getStatusLabel(status: SyncStatus | undefined, copy: Dictionary) {
  if (!status || status === "idle") {
    return copy.sync.idle;
  }

  switch (status) {
    case "editing":
      return copy.sync.editing;
    case "saving":
      return copy.sync.saving;
    case "saved-local":
      return copy.sync.savedLocal;
    case "saved-cloud":
      return copy.sync.savedCloud;
    case "error":
      return copy.sync.error;
    default:
      return copy.sync.idle;
  }
}

function SnippetCard({
  snippet,
  folderOptions,
  status,
  copy,
  onChange,
}: {
  snippet: SnippetRecord;
  folderOptions: FolderOption[];
  status: SyncStatus | undefined;
  copy: Dictionary;
  onChange: (
    snippetId: string,
    patch: Partial<Pick<SnippetRecord, "title" | "language" | "code" | "folderId" | "isPinned">>
  ) => Promise<void>;
}) {
  function handleTextChange(
    field: "title" | "language" | "code",
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    void onChange(snippet.id, { [field]: event.target.value });
  }

  function handleFolderChange(event: ChangeEvent<HTMLSelectElement>) {
    void onChange(snippet.id, { folderId: event.target.value || null });
  }

  function handlePinnedChange(event: ChangeEvent<HTMLInputElement>) {
    void onChange(snippet.id, { isPinned: event.target.checked });
  }

  return (
    <article className="rounded border border-white/10 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <strong>{snippet.title || copy.forms.snippetName}</strong>
        <span className="text-sm text-zinc-400">
          {copy.snippetCard.status}: {getStatusLabel(status, copy)}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span>{copy.snippetCard.title}</span>
          <input
            className="rounded border border-white/10 bg-black/30 px-3 py-2"
            value={snippet.title}
            onChange={(event) => handleTextChange("title", event)}
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span>{copy.snippetCard.language}</span>
          <input
            className="rounded border border-white/10 bg-black/30 px-3 py-2"
            value={snippet.language}
            onChange={(event) => handleTextChange("language", event)}
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span>{copy.snippetCard.folder}</span>
          <select
            className="rounded border border-white/10 bg-black/30 px-3 py-2"
            value={snippet.folderId ?? ""}
            onChange={handleFolderChange}
          >
            {folderOptions.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-6 flex items-center gap-2 text-sm">
          <input checked={snippet.isPinned} type="checkbox" onChange={handlePinnedChange} />
          <span>{copy.forms.snippetPinned}</span>
        </label>
      </div>

      <label className="mt-3 grid gap-1 text-sm">
        <span>{copy.snippetCard.code}</span>
        <textarea
          className="min-h-44 rounded border border-white/10 bg-black/30 px-3 py-2 font-mono"
          value={snippet.code}
          onChange={(event) => handleTextChange("code", event)}
        />
      </label>
    </article>
  );
}

function FolderTree({
  folder,
  foldersByParent,
  snippetsByFolder,
  folderOptions,
  snippetStatuses,
  copy,
  onSnippetChange,
}: {
  folder: FolderRecord;
  foldersByParent: Map<string | null, FolderRecord[]>;
  snippetsByFolder: Map<string | null, SnippetRecord[]>;
  folderOptions: FolderOption[];
  snippetStatuses: Record<string, SyncStatus>;
  copy: Dictionary;
  onSnippetChange: (
    snippetId: string,
    patch: Partial<Pick<SnippetRecord, "title" | "language" | "code" | "folderId" | "isPinned">>
  ) => Promise<void>;
}) {
  const nestedFolders = foldersByParent.get(folder.id) ?? [];
  const folderSnippets = snippetsByFolder.get(folder.id) ?? [];
  const isEmpty = nestedFolders.length === 0 && folderSnippets.length === 0;

  return (
    <details className="rounded border border-white/10 p-3" open>
      <summary className="cursor-pointer list-none font-semibold">
        <span>{folder.name}</span>
        {folder.isPinned ? <span className="ml-2 text-sm text-zinc-400">{copy.workspace.pinnedBadge}</span> : null}
      </summary>

      <div className="mt-3 grid gap-3 pl-4">
        {folderSnippets.map((snippet) => (
          <SnippetCard
            key={snippet.id}
            copy={copy}
            folderOptions={folderOptions}
            snippet={snippet}
            status={snippetStatuses[snippet.id]}
            onChange={onSnippetChange}
          />
        ))}

        {nestedFolders.map((nestedFolder) => (
          <FolderTree
            key={nestedFolder.id}
            copy={copy}
            folder={nestedFolder}
            foldersByParent={foldersByParent}
            folderOptions={folderOptions}
            snippetStatuses={snippetStatuses}
            snippetsByFolder={snippetsByFolder}
            onSnippetChange={onSnippetChange}
          />
        ))}

        {isEmpty ? <p className="text-sm text-zinc-400">{copy.workspace.emptyFolder}</p> : null}
      </div>
    </details>
  );
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
  const [folderForm, setFolderForm] = useState<FolderFormState>({
    name: "",
    parentId: "",
    isPinned: false,
  });
  const [snippetForm, setSnippetForm] = useState<SnippetFormState>({
    title: "",
    language: "typescript",
    folderId: "",
    isPinned: false,
    code: "",
  });
  const localStatusTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
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

    return () => {
      if (cloudSyncTimerRef.current) {
        clearTimeout(cloudSyncTimerRef.current);
      }

      for (const timer of localStatusTimers.values()) {
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

  async function handleCreateFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!folderForm.name.trim()) {
      return;
    }

    const timestamp = new Date().toISOString();

    await db.folders.put({
      id: crypto.randomUUID(),
      ownerId: user?.id ?? null,
      name: folderForm.name.trim(),
      parentId: folderForm.parentId || null,
      isPinned: folderForm.isPinned,
      createdAt: timestamp,
      updatedAt: timestamp,
      dirty: true,
      lastSyncedAt: null,
    });

    setFolderForm({
      name: "",
      parentId: "",
      isPinned: false,
    });

    refreshWorkspace();

    if (user && supabaseConfigured) {
      scheduleCloudSync();
    }
  }

  async function handleCreateSnippet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!snippetForm.title.trim() || !snippetForm.language.trim() || !snippetForm.code.trim()) {
      return;
    }

    const snippetId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    await db.snippets.put({
      id: snippetId,
      ownerId: user?.id ?? null,
      folderId: snippetForm.folderId || null,
      title: snippetForm.title.trim(),
      language: snippetForm.language.trim(),
      code: snippetForm.code,
      isPinned: snippetForm.isPinned,
      createdAt: timestamp,
      updatedAt: timestamp,
      dirty: true,
      lastSyncedAt: null,
    });

    setSnippetStatuses((currentStatuses) => ({
      ...currentStatuses,
      [snippetId]: "editing",
    }));

    setSnippetForm({
      title: "",
      language: "typescript",
      folderId: "",
      isPinned: false,
      code: "",
    });

    refreshWorkspace();

    if (user && supabaseConfigured) {
      scheduleCloudSync();
      return;
    }

    settleLocally(snippetId);
  }

  async function handleSnippetChange(
    snippetId: string,
    patch: Partial<Pick<SnippetRecord, "title" | "language" | "code" | "folderId" | "isPinned">>
  ) {
    const currentSnippet = await db.snippets.get(snippetId);

    if (!currentSnippet) {
      return;
    }

    await db.snippets.put({
      ...currentSnippet,
      ...patch,
      ownerId: user?.id ?? currentSnippet.ownerId,
      updatedAt: new Date().toISOString(),
      dirty: true,
    });

    setSnippetStatus(snippetId, "editing");
    refreshWorkspace();

    if (user && supabaseConfigured) {
      scheduleCloudSync();
      return;
    }

    settleLocally(snippetId);
  }

  const folders = workspaceQuery.data?.folders ?? [];
  const snippets = workspaceQuery.data?.snippets ?? [];
  const folderOptions = buildFolderOptions(folders, copy.workspace.rootOption);
  const foldersByParent = groupFoldersByParent(folders);
  const snippetsByFolder = groupSnippetsByFolder(snippets);
  const rootFolders = foldersByParent.get(null) ?? [];
  const rootSnippets = snippetsByFolder.get(null) ?? [];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 text-zinc-100">
      <header className="grid gap-2 rounded border border-white/10 p-4">
        <h1 className="text-2xl font-semibold">{copy.app.title}</h1>
        <p className="text-sm text-zinc-400">{copy.app.subtitle}</p>
        <p className="text-sm">
          {copy.auth.statusLabel}: {authReady ? (user ? copy.auth.signedIn : copy.auth.signedOut) : copy.workspace.loading}
        </p>
        <p className="text-sm text-zinc-400">{accountMessage}</p>
        {user ? (
          <p className="text-sm text-zinc-400">
            {copy.auth.signedInAs}: {user.email ?? user.id}
          </p>
        ) : null}
        <div>
          {user ? (
            <button
              className="rounded border border-white/10 px-3 py-2"
              type="button"
              onClick={handleSignOut}
            >
              {copy.auth.signOut}
            </button>
          ) : (
            <button
              className="rounded border border-white/10 px-3 py-2 disabled:opacity-50"
              disabled={!supabaseConfigured}
              type="button"
              onClick={handleGitHubSignIn}
            >
              {copy.auth.signIn}
            </button>
          )}
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        <form className="grid gap-3 rounded border border-white/10 p-4" onSubmit={handleCreateFolder}>
          <h2 className="text-lg font-semibold">{copy.forms.folderTitle}</h2>
          <label className="grid gap-1 text-sm">
            <span>{copy.forms.folderName}</span>
            <input
              className="rounded border border-white/10 bg-black/30 px-3 py-2"
              value={folderForm.name}
              onChange={(event) =>
                setFolderForm((currentForm) => ({
                  ...currentForm,
                  name: event.target.value,
                }))
              }
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>{copy.forms.folderParent}</span>
            <select
              className="rounded border border-white/10 bg-black/30 px-3 py-2"
              value={folderForm.parentId}
              onChange={(event) =>
                setFolderForm((currentForm) => ({
                  ...currentForm,
                  parentId: event.target.value,
                }))
              }
            >
              {folderOptions.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              checked={folderForm.isPinned}
              type="checkbox"
              onChange={(event) =>
                setFolderForm((currentForm) => ({
                  ...currentForm,
                  isPinned: event.target.checked,
                }))
              }
            />
            <span>{copy.forms.folderPinned}</span>
          </label>

          <button className="rounded border border-white/10 px-3 py-2" type="submit">
            {copy.forms.submitFolder}
          </button>
        </form>

        <form className="grid gap-3 rounded border border-white/10 p-4" onSubmit={handleCreateSnippet}>
          <h2 className="text-lg font-semibold">{copy.forms.snippetTitle}</h2>
          <label className="grid gap-1 text-sm">
            <span>{copy.forms.snippetName}</span>
            <input
              className="rounded border border-white/10 bg-black/30 px-3 py-2"
              value={snippetForm.title}
              onChange={(event) =>
                setSnippetForm((currentForm) => ({
                  ...currentForm,
                  title: event.target.value,
                }))
              }
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>{copy.forms.snippetLanguage}</span>
            <input
              className="rounded border border-white/10 bg-black/30 px-3 py-2"
              value={snippetForm.language}
              onChange={(event) =>
                setSnippetForm((currentForm) => ({
                  ...currentForm,
                  language: event.target.value,
                }))
              }
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>{copy.forms.snippetFolder}</span>
            <select
              className="rounded border border-white/10 bg-black/30 px-3 py-2"
              value={snippetForm.folderId}
              onChange={(event) =>
                setSnippetForm((currentForm) => ({
                  ...currentForm,
                  folderId: event.target.value,
                }))
              }
            >
              {folderOptions.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              checked={snippetForm.isPinned}
              type="checkbox"
              onChange={(event) =>
                setSnippetForm((currentForm) => ({
                  ...currentForm,
                  isPinned: event.target.checked,
                }))
              }
            />
            <span>{copy.forms.snippetPinned}</span>
          </label>

          <label className="grid gap-1 text-sm">
            <span>{copy.forms.snippetCode}</span>
            <textarea
              className="min-h-40 rounded border border-white/10 bg-black/30 px-3 py-2 font-mono"
              value={snippetForm.code}
              onChange={(event) =>
                setSnippetForm((currentForm) => ({
                  ...currentForm,
                  code: event.target.value,
                }))
              }
            />
          </label>

          <button className="rounded border border-white/10 px-3 py-2" type="submit">
            {copy.forms.submitSnippet}
          </button>
        </form>
      </section>

      <section className="grid gap-4 rounded border border-white/10 p-4">
        <h2 className="text-lg font-semibold">{copy.workspace.rootSnippets}</h2>

        {workspaceQuery.isPending ? <p>{copy.workspace.loading}</p> : null}
        {workspaceQuery.isError ? <p>{copy.workspace.loadError}</p> : null}

        {!workspaceQuery.isPending && rootSnippets.length === 0 ? (
          <p className="text-sm text-zinc-400">{copy.workspace.noRootSnippets}</p>
        ) : null}

        {rootSnippets.map((snippet) => (
          <SnippetCard
            key={snippet.id}
            copy={copy}
            folderOptions={folderOptions}
            snippet={snippet}
            status={snippetStatuses[snippet.id]}
            onChange={handleSnippetChange}
          />
        ))}
      </section>

      <section className="grid gap-4 rounded border border-white/10 p-4">
        <h2 className="text-lg font-semibold">{copy.workspace.folders}</h2>

        {rootFolders.length === 0 ? (
          <p className="text-sm text-zinc-400">{copy.workspace.noFolders}</p>
        ) : null}

        {rootFolders.map((folder) => (
          <FolderTree
            key={folder.id}
            copy={copy}
            folder={folder}
            foldersByParent={foldersByParent}
            folderOptions={folderOptions}
            snippetStatuses={snippetStatuses}
            snippetsByFolder={snippetsByFolder}
            onSnippetChange={handleSnippetChange}
          />
        ))}
      </section>
    </div>
  );
}