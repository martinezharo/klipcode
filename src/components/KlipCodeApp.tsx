"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Menu } from "lucide-react";

import { readTrash, readWorkspace } from "@/lib/db";
import { seedWelcomeContent } from "@/lib/seed";
import type { ClipboardEntry, SnippetRecord, WorkspaceSnapshot } from "@/lib/types";
import { getDictionary } from "@/i18n";
import { localeHref, LOCALE_COOKIE, type Locale } from "@/lib/locale";
import { SPACE_ROOT_ID, TRASH_ROOT_ID } from "@/lib/navigation";
import { Tooltip } from "@/ui/Tooltip";
import { Spinner } from "@/ui/Spinner";

import { useResponsiveSidebar } from "@/hooks/useResponsiveSidebar";
import { useAuth } from "@/hooks/useAuth";
import { useCloudSync } from "@/hooks/useCloudSync";
import { useWorkspaceMutations } from "@/hooks/useWorkspaceMutations";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { usePreferences } from "@/hooks/usePreferences";
import { useTheme } from "@/hooks/useTheme";

import { AccountToast } from "@/components/AccountToast/AccountToast";
import { CopyToast } from "@/components/CopyToast/CopyToast";
import { Aside } from "@/components/Aside/Aside";
import { ConfirmDialog } from "@/components/ConfirmDialog/ConfirmDialog";
import { CreateSnippetModal } from "@/components/CreateSnippetModal/CreateSnippetModal";
import { CreatedSnippetToast } from "@/components/CreatedSnippetToast/CreatedSnippetToast";
import { DragProvider } from "@/components/DragContext";
import { NewSnippet } from "@/components/NewSnippet/NewSnippet";
import { SnippetCards } from "@/components/SnippetCards/SnippetCards";
import { TitleGenerationProvider } from "@/components/TitleGeneration";
import { SnippetEditor } from "@/components/SnippetEditor/SnippetEditor";
import { FolderView } from "@/components/FolderView/FolderView";
import { TrashView } from "@/components/TrashView/TrashView";
import { SearchPalette } from "@/components/SearchPalette/SearchPalette";
import { ShortcutsDialog } from "@/components/ShortcutsDialog/ShortcutsDialog";
import { PreferencesDialog } from "@/components/PreferencesDialog/PreferencesDialog";

const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export default function KlipCodeApp({ locale }: { locale: "en" | "es" }) {
  const copy = getDictionary(locale);
  const queryClient = useQueryClient();
  const { sidebarOpen, setSidebarOpen, isMobile } = useResponsiveSidebar();
  const { preferences, updatePreferences } = usePreferences();
  const { theme, setTheme } = useTheme();

  function refreshWorkspace() {
    startTransition(() => {
      void queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] === "workspace" || q.queryKey[0] === "trash",
      });
    });
  }

  /**
   * Patch a single snippet in the cached workspace instead of invalidating the
   * whole query. The hot path — every debounced keystroke — would otherwise
   * re-read and re-sort the entire IndexedDB workspace; this touches only the one
   * record. Order is left untouched until the next full refresh (re-sorting on
   * each keystroke would make cards jump around mid-edit anyway).
   */
  function patchSnippetInCache(id: string, changes: Partial<SnippetRecord>) {
    startTransition(() => {
      queryClient.setQueryData<WorkspaceSnapshot>(
        ["workspace", auth.user?.id ?? "guest"],
        (old) =>
          old
            ? {
                ...old,
                snippets: old.snippets.map((s) => (s.id === id ? { ...s, ...changes } : s)),
              }
            : old
      );
    });
  }

  // onReconciled callback references sync.setSnippetStatus — safe because it's
  // only invoked asynchronously from effects, well after all hooks initialise.
  const auth = useAuth({
    copy,
    refreshWorkspace,
    onReconciled: (ids) => {
      for (const id of ids) sync.setSnippetStatus(id, "saved-cloud");
    },
  });

  const sync = useCloudSync({
    user: auth.user,
    supabaseConfigured: auth.supabaseConfigured,
    copy,
    refreshWorkspace,
    setAccountMessage: auth.setAccountMessage,
  });

  /* ── URL-based navigation ─────────────────────────────────────────────── */

  const searchParams = useSearchParams();
  const base = localeHref(locale, "/app");

  /**
   * View switches (?snippet= / ?folder=) only change the URL search params, which
   * are client-side state — the /app route never reads searchParams on the server.
   * Using router.push for them runs a full Next navigation and refetches the RSC
   * payload on every click (a network round-trip in production — the lag). The
   * native History API updates the URL and stays in sync with useSearchParams
   * without any server work, so view switches are instant. This is Next.js'
   * documented "shallow routing on the client".
   */
  const navigate = useCallback((url: string) => {
    window.history.pushState(null, "", url);
  }, []);
  const navigateReplace = useCallback((url: string) => {
    window.history.replaceState(null, "", url);
  }, []);

  const selectedSnippetId = searchParams.get("snippet");
  const selectedFolderId = searchParams.get("folder");

  /** Used by useWorkspaceMutations which needs a (id: string | null) => void setter. */
  function setSelectedSnippetId(id: string | null) {
    if (id !== null) navigate(`${base}?snippet=${id}`);
    else navigate(base);
  }

  /* ── Clipboard state ──────────────────────────────────────────────────── */

  const [clipboard, setClipboard] = useState<ClipboardEntry | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [copyNonce, setCopyNonce] = useState(0);
  const [undoNonce, setUndoNonce] = useState(0);
  const [pendingEmptyTrash, setPendingEmptyTrash] = useState(false);

  /* ── AI title generation state ────────────────────────────────────────────
     Snippets whose name Workers AI is currently inferring in the background, so
     the tree/cards/editor can shimmer a placeholder instead of "Untitled". */
  const [titleGeneratingIds, setTitleGeneratingIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const setTitleGenerating = useCallback((id: string, on: boolean) => {
    setTitleGeneratingIds((prev) => {
      if (prev.has(id) === on) return prev;
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  /* ── Create-snippet modal + "open it?" toast ─────────────────────────── */

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalFolderId, setCreateModalFolderId] = useState<string | null>(null);
  const [createModalFocusNonce, setCreateModalFocusNonce] = useState(0);
  const [createdSnippetId, setCreatedSnippetId] = useState<string | null>(null);
  const [createdSnippetNonce, setCreatedSnippetNonce] = useState(0);

  function openCreateModal(folderId: string | null) {
    setCreateModalFolderId(folderId);
    setCreateModalOpen(true);
    setCreateModalFocusNonce((n) => n + 1);
  }

  /* ── Workspace data ───────────────────────────────────────────────────── */

  const workspaceQuery = useQuery({
    queryKey: ["workspace", auth.user?.id ?? "guest"],
    queryFn: () => readWorkspace(auth.user?.id ?? null),
  });

  const folders = useMemo(() => workspaceQuery.data?.folders ?? [], [workspaceQuery.data]);
  const snippets = useMemo(() => workspaceQuery.data?.snippets ?? [], [workspaceQuery.data]);

  const trashQuery = useQuery({
    queryKey: ["trash", auth.user?.id ?? "guest"],
    queryFn: () => readTrash(auth.user?.id ?? null),
  });

  const trashedFolders = useMemo(() => trashQuery.data?.folders ?? [], [trashQuery.data]);
  const trashedSnippets = useMemo(() => trashQuery.data?.snippets ?? [], [trashQuery.data]);
  const trashCount = trashedFolders.length + trashedSnippets.length;

  // The trash reuses the `?folder=` param: the root sentinel, or a trashed folder
  // id when drilling into a deleted subtree.
  const isTrashView =
    !!selectedFolderId &&
    (selectedFolderId === TRASH_ROOT_ID || trashedFolders.some((f) => f.id === selectedFolderId));

  /* ── Mutations ────────────────────────────────────────────────────────── */

  const mutations = useWorkspaceMutations({
    copy,
    user: auth.user,
    supabaseConfigured: auth.supabaseConfigured,
    folders,
    snippets,
    clipboard,
    setClipboard,
    selectedSnippetId,
    setSelectedSnippetId,
    refreshWorkspace,
    patchSnippetInCache,
    scheduleCloudSync: sync.scheduleCloudSync,
    settleLocally: sync.settleLocally,
    setSnippetStatus: sync.setSnippetStatus,
    setTitleGenerating,
    autoGenerateTitle: preferences.autoGenerateTitle,
  });

  /* ── First-visit seeding ────────────────────────────────────────────────── */

  useEffect(() => {
    if (!auth.authReady || auth.user) return;
    void seedWelcomeContent(copy).then((seeded) => {
      if (seeded) refreshWorkspace();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.authReady, auth.user]);

  /* ── Derived state & side-effects ─────────────────────────────────────── */

  useEffect(() => {
    if (!workspaceQuery.isSuccess || !trashQuery.isSuccess) return;
    if (!selectedFolderId || selectedFolderId === SPACE_ROOT_ID || selectedFolderId === TRASH_ROOT_ID) return;
    const exists =
      folders.some((f) => f.id === selectedFolderId) || trashedFolders.some((f) => f.id === selectedFolderId);
    if (!exists) navigateReplace(base);
  }, [folders, trashedFolders, selectedFolderId, workspaceQuery.isSuccess, trashQuery.isSuccess, navigateReplace, base]);

  const selectedSnippet = selectedSnippetId
    ? (snippets.find((s) => s.id === selectedSnippetId) ??
        trashedSnippets.find((s) => s.id === selectedSnippetId) ??
        null)
    : null;
  // A trashed snippet opens read-only with restore / delete-permanently actions.
  const selectedSnippetTrashed = !!selectedSnippet?.deletedAt;
  // Both workspace and trash must be loaded before concluding a ?snippet= id
  // is missing rather than just not-yet-fetched (mirrors the folder-validity
  // effect above).
  const snippetNotFound =
    !!selectedSnippetId && !selectedSnippet && workspaceQuery.isSuccess && trashQuery.isSuccess;

  // The preferred default folder for new snippets, validated against the live
  // workspace — a stored id whose folder was deleted falls back to root.
  const preferredDefaultFolderId =
    preferences.defaultFolderId && folders.some((f) => f.id === preferences.defaultFolderId)
      ? preferences.defaultFolderId
      : null;

  function handleChangeLocale(next: Locale) {
    if (next === locale) {
      setPrefsOpen(false);
      return;
    }
    // Persist the explicit choice so it wins over Accept-Language (mirrors
    // LocaleSwitchLink), then hard-navigate to the same view in the new locale.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
    window.location.assign(localeHref(next, "/app") + window.location.search);
  }

  /* ── Global keyboard shortcuts ────────────────────────────────────────── */

  useGlobalShortcuts({
    onToggleSearch: () => setSearchOpen((v) => !v),
    onToggleHelp: () => setHelpOpen((v) => !v),
    onNewSnippet: () => {
      openCreateModal(selectedFolderId ?? preferredDefaultFolderId);
    },
    onCopyCurrent: () => {
      if (!selectedSnippet) return;
      void navigator.clipboard
        .writeText(selectedSnippet.code)
        .then(() => setCopyNonce((n) => n + 1));
    },
    onToggleSidebar: () => setSidebarOpen((v) => !v),
    onCloseEditor: () => navigate(base),
    onUndoDelete: () => {
      void mutations.handleUndoDelete().then((undone) => {
        if (undone) setUndoNonce((n) => n + 1);
      });
    },
    hasOpenSnippet: !!selectedSnippet,
    overlayOpen: searchOpen || helpOpen || prefsOpen || pendingEmptyTrash || createModalOpen,
  });

  const menuButton = !sidebarOpen ? (
    <Tooltip content={copy.aside.open} placement="bottom">
      <button
        type="button"
        aria-label={copy.aside.open}
        onClick={() => setSidebarOpen(true)}
        className="shrink-0 rounded-md p-1.5 text-ink/40 transition-colors hover:bg-ink/6 hover:text-ink/70"
      >
        <Menu size={16} />
      </button>
    </Tooltip>
  ) : null;

  // Keep the top-bar footprint stable while the desktop aside opens and closes.
  // Only the toggle changes visibility; content below it must not move vertically.
  const menuBar = (
    <div className="sticky top-0 z-10 flex h-11 shrink-0 items-center border-b border-transparent px-3">
      {menuButton}
    </div>
  );

  /* ── Render ───────────────────────────────────────────────────────────── */

  // IndexedDB can be unavailable (Safari private mode, storage pressure). Surface
  // it instead of silently showing an empty workspace.
  if (workspaceQuery.isError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-ink/60">{copy.workspace.loadError}</p>
        <button
          type="button"
          onClick={() => void workspaceQuery.refetch()}
          className="rounded-md bg-ink/10 px-4 py-2 text-sm text-ink/80 transition-colors hover:bg-ink/15"
        >
          {copy.error.retry}
        </button>
      </div>
    );
  }

  // First read of the local workspace from IndexedDB. Show a spinner instead of a
  // blank shell so a cold start (or a large workspace) doesn't look frozen.
  if (workspaceQuery.isPending) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-ink/45">
        <Spinner size={22} label={copy.workspace.loading} />
        <p className="text-sm">{copy.workspace.loading}</p>
      </div>
    );
  }

  return (
    <TitleGenerationProvider ids={titleGeneratingIds}>
    <DragProvider
      folders={folders}
      onMoveFolder={mutations.handleMoveFolder}
      onMoveSnippet={mutations.handleMoveSnippet}
      onMoveMany={mutations.handleMoveMany}
      onTrashItem={(item) => {
        if (item.type === "folder") void mutations.handleDeleteFolder(item.id);
        else void mutations.handleDeleteSnippet(item.id);
      }}
      onTrashMany={(items) => void mutations.handleDeleteMany(items)}
      onRestoreItem={(item, targetFolderId) => {
        if (item.type === "folder") void mutations.handleRestoreFolder(item.id, targetFolderId);
        else void mutations.handleRestoreSnippet(item.id, targetFolderId);
      }}
      onRestoreMany={(items, targetFolderId) => void mutations.handleRestoreMany(items, targetFolderId)}
    >
    <div className="flex h-screen overflow-hidden">
      <Aside
        user={auth.user}
        authReady={auth.authReady}
        folders={folders}
        snippets={snippets}
        copy={copy}
        clipboard={clipboard}
        isOpen={sidebarOpen}
        isMobile={isMobile}
        onSetOpen={setSidebarOpen}
        onSelectSnippet={(id) => navigate(`${base}?snippet=${id}`)}
        onGoHome={() => navigate(base)}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenShortcuts={() => setHelpOpen(true)}
        onOpenPreferences={() => setPrefsOpen(true)}
        onGoSpace={() => navigate(`${base}?folder=${SPACE_ROOT_ID}`)}
        onOpenCreateModal={openCreateModal}
        onCreateFolder={mutations.handleCreateFolder}
        onDeleteFolder={mutations.handleDeleteFolder}
        onDeleteSnippet={mutations.handleDeleteSnippet}
        onDeleteMany={mutations.handleDeleteMany}
        onRenameFolder={mutations.handleRenameFolder}
        onRenameSnippet={mutations.handleRenameSnippet}
        onPinFolder={mutations.handlePinFolder}
        onPinSnippet={mutations.handlePinSnippet}
        onCut={setClipboard}
        onCopy={(entry) => setClipboard({ ...entry, type: "copy" })}
        onPaste={mutations.handlePaste}
        onSignIn={auth.handleGitHubSignIn}
        onSignOut={auth.handleSignOut}
        signingIn={auth.signingIn}
        signingOut={auth.signingOut}
        onSelectFolder={(folderId) => navigate(`${base}?folder=${folderId}`)}
        onOpenTrash={() => navigate(`${base}?folder=${TRASH_ROOT_ID}`)}
        onRestoreAll={() => void mutations.handleRestoreAll()}
        onEmptyTrash={() => setPendingEmptyTrash(true)}
        trashCount={trashCount}
        selectedSnippetId={selectedSnippetId}
        selectedFolderId={selectedFolderId}
      />

      <div className="relative flex flex-1 flex-col overflow-hidden">
        <AccountToast message={auth.accountMessage} />

        {selectedSnippet ? (
          <div className="flex-1 overflow-hidden">
            <SnippetEditor
              key={selectedSnippet.id}
              snippet={selectedSnippet}
              // A trashed snippet's ancestors live only in the trashed set; pass
              // those so its breadcrumb resolves the (also trashed) folder path.
              folders={selectedSnippetTrashed ? trashedFolders : folders}
              copy={copy}
              syncStatus={sync.snippetStatuses[selectedSnippet.id] ?? "idle"}
              onClose={() => navigate(selectedSnippetTrashed ? `${base}?folder=${TRASH_ROOT_ID}` : base)}
              onNavigateFolder={(folderId) => navigate(`${base}?folder=${folderId}`)}
              onNavigateHome={() =>
                navigate(`${base}?folder=${selectedSnippetTrashed ? TRASH_ROOT_ID : SPACE_ROOT_ID}`)
              }
              onUpdate={mutations.handleUpdateSnippet}
              onRename={mutations.handleRenameSnippet}
              markdownPreviewByDefault={preferences.markdownPreviewByDefault}
              defaultCodeLanguage={preferences.defaultLanguage}
              codeWrap={preferences.codeWrap}
              onMarkdownPreviewChange={(open) =>
                updatePreferences({ markdownPreviewByDefault: open })
              }
              menuButton={menuButton}
              readOnly={selectedSnippetTrashed}
              trashActions={
                selectedSnippetTrashed
                  ? {
                      onRestore: () => void mutations.handleRestoreSnippet(selectedSnippet.id),
                      onDeletePermanently: () =>
                        void mutations.handlePermanentlyDeleteSnippet(selectedSnippet.id),
                    }
                  : undefined
              }
            />
          </div>
        ) : snippetNotFound ? (
          <main className="flex flex-1 flex-col overflow-y-auto">
            {menuBar}
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
              <p className="text-sm font-medium text-ink/70">{copy.workspace.snippetNotFoundTitle}</p>
              <p className="max-w-sm text-sm text-ink/50">{copy.workspace.snippetNotFoundDescription}</p>
              <button
                type="button"
                onClick={() => navigate(base)}
                className="rounded-md bg-ink/10 px-4 py-2 text-sm text-ink/80 transition-colors hover:bg-ink/15"
              >
                {copy.notFound.backHome}
              </button>
            </div>
          </main>
        ) : isTrashView ? (
          <TrashView
            folderId={selectedFolderId!}
            folders={trashedFolders}
            snippets={trashedSnippets}
            copy={copy}
            onNavigateFolder={(folderId) => navigate(`${base}?folder=${folderId}`)}
            onNavigateTrashRoot={() => navigate(`${base}?folder=${TRASH_ROOT_ID}`)}
            onSelectSnippet={(id) => navigate(`${base}?snippet=${id}`)}
            onRestoreSnippet={(id) => void mutations.handleRestoreSnippet(id)}
            onPermanentlyDeleteSnippet={(id) => void mutations.handlePermanentlyDeleteSnippet(id)}
            onRestoreFolder={(id) => void mutations.handleRestoreFolder(id)}
            onPermanentlyDeleteFolder={(id) => void mutations.handlePermanentlyDeleteFolder(id)}
            onRestoreMany={(items) => void mutations.handleRestoreMany(items)}
            onPermanentlyDeleteMany={(items) => void mutations.handlePermanentlyDeleteMany(items)}
            onRestoreAll={() => void mutations.handleRestoreAll()}
            onEmptyTrash={() => setPendingEmptyTrash(true)}
            menuButton={menuButton}
          />
        ) : selectedFolderId ? (
          <FolderView
            folderId={selectedFolderId}
            folders={folders}
            snippets={snippets}
            copy={copy}
            clipboard={clipboard}
            onSelectSnippet={(id) => navigate(`${base}?snippet=${id}`)}
            onNavigateFolder={(folderId) => navigate(`${base}?folder=${folderId}`)}
            onNavigateHome={() => navigate(`${base}?folder=${SPACE_ROOT_ID}`)}
            onPinSnippet={mutations.handlePinSnippet}
            onPinFolder={mutations.handlePinFolder}
            onDeleteSnippet={mutations.handleDeleteSnippet}
            onRenameSnippet={mutations.handleRenameSnippet}
            onDeleteFolder={mutations.handleDeleteFolder}
            onRenameFolder={mutations.handleRenameFolder}
            onCut={setClipboard}
            onCopy={(entry) => setClipboard({ ...entry, type: "copy" })}
            onDeleteMany={mutations.handleDeleteMany}
            onPaste={mutations.handlePaste}
            onCreateFolder={mutations.handleCreateFolder}
            onOpenCreateModal={openCreateModal}
            menuButton={menuButton}
          />
        ) : (
          <main className="flex-1 overflow-y-auto">
            {menuBar}
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-8">
              <NewSnippet
                copy={copy}
                folders={folders}
                defaultFolderId={preferredDefaultFolderId}
                defaultLanguage={preferences.defaultLanguage}
                codeWrap={preferences.codeWrap}
                onCreateSnippet={mutations.handleCreateSnippet}
              />

              <SnippetCards
                snippets={snippets}
                folders={folders}
                copy={copy}
                clipboard={clipboard}
                onSelectSnippet={(id) => navigate(`${base}?snippet=${id}`)}
                onNavigateFolder={(folderId) => navigate(`${base}?folder=${folderId}`)}
                onPinSnippet={mutations.handlePinSnippet}
                onDeleteSnippet={mutations.handleDeleteSnippet}
                onRenameSnippet={mutations.handleRenameSnippet}
                onCutSnippet={(id) => setClipboard({ type: "cut", items: [{ itemType: "snippet", id }] })}
                onCopySnippet={(id) => setClipboard({ type: "copy", items: [{ itemType: "snippet", id }] })}
                onPaste={mutations.handlePaste}
              />
            </div>
          </main>
        )}
      </div>
    </div>

    {searchOpen && (
      <SearchPalette
        snippets={snippets}
        folders={folders}
        copy={copy}
        onSelectSnippet={(id) => navigate(`${base}?snippet=${id}`)}
        onClose={() => setSearchOpen(false)}
      />
    )}

    {helpOpen && <ShortcutsDialog copy={copy} onClose={() => setHelpOpen(false)} />}

    {prefsOpen && (
      <PreferencesDialog
        copy={copy}
        locale={locale}
        theme={theme}
        folders={folders}
        preferences={preferences}
        isAuthenticated={!!auth.user}
        onChangePreferences={updatePreferences}
        onChangeLocale={handleChangeLocale}
        onChangeTheme={setTheme}
        onClose={() => setPrefsOpen(false)}
      />
    )}

    <CopyToast nonce={copyNonce} message={copy.snippetEditor.codeCopied} />
    <CopyToast nonce={undoNonce} message={copy.trash.undoRestored} />

    {createModalOpen && (
      <CreateSnippetModal
        copy={copy}
        folders={folders}
        defaultFolderId={createModalFolderId}
        defaultLanguage={preferences.defaultLanguage}
        codeWrap={preferences.codeWrap}
        focusNonce={createModalFocusNonce}
        onClose={() => setCreateModalOpen(false)}
        onCreateSnippet={async (data) => {
          const id = await mutations.handleCreateSnippet(data);
          setCreateModalOpen(false);
          if (id) {
            setCreatedSnippetId(id);
            setCreatedSnippetNonce((n) => n + 1);
          }
          return id;
        }}
      />
    )}

    <CreatedSnippetToast
      nonce={createdSnippetNonce}
      snippetId={createdSnippetId}
      copy={copy}
      onOpen={(id) => navigate(`${base}?snippet=${id}`)}
    />

    {pendingEmptyTrash && (
      <ConfirmDialog
        title={copy.trash.emptyTitle}
        warning={copy.trash.emptyWarning}
        confirmLabel={copy.trash.emptyTrash}
        cancelLabel={copy.trash.cancel}
        folderCount={trashedFolders.length}
        snippetCount={trashedSnippets.length}
        folderCountLabel={copy.trash.folderCount}
        snippetCountLabel={copy.trash.snippetCount}
        onCancel={() => setPendingEmptyTrash(false)}
        onConfirm={() => {
          void mutations.handleEmptyTrash();
          setPendingEmptyTrash(false);
          if (isTrashView) navigate(`${base}?folder=${TRASH_ROOT_ID}`);
        }}
      />
    )}
    </DragProvider>
    </TitleGenerationProvider>
  );
}
