const WELCOME_SNIPPET_CONTENT = `# Welcome to KlipCode!

KlipCode is a tool designed to keep your favorite code snippets always at hand,
quickly and easily, across all your devices.

## What can you do?

- **Quick save:** Save a *snippet* in a couple of clicks without needing to sign in.
- **Instant copy:** Copy the content of your snippets to the clipboard instantly.
- **Hierarchical organization:** Create folders with multiple depth levels to organize your code.
- **Intuitive management:** Move your *snippets* and folders by dragging them to fit your workflow.
- **GitHub sync:** Sign in to have your data automatically synced to the cloud.
- **Advanced editor:** Edit your snippets comfortably with an auto-save system.
- **Priority access:** Pin your most important *snippets* both in folders and on the home page.

## Getting started

1. **Create your first snippet:** Use the creator on the home page or the button
   in the sidebar to add this JSX code at the root level with the title \`Component\`:

\`\`\`
const Greet = ({ name }) => {
  return (
    <div className="user-card">
      <h1>{name}</h1>
      <button onClick={() => console.log(\`Hello \${name}\`)}>
        Click
      </button>
    </div>
  );
};
\`\`\`

2. **Open the editor:** Click on the file you created in the sidebar.
3. **Organize the content:** Create a folder called \`my-components\` from the sidebar
   and drag your new component into it.
4. **Done!:** You can now start exploring KlipCode to boost your productivity.
   You can delete all the example snippets and folders if you want — just right-click on
   them in the sidebar and select "Delete".`;

export const en = {
  app: {
    title: "KlipCode",
    subtitle: "Multi-device snippet manager.",
  },
  auth: {
    statusLabel: "Session status",
    signedIn: "Signed in",
    signedOut: "Signed out",
    signIn: "Sign In",
    signOut: "Sign Out",
    localMode: "Local mode active. Changes are saved to IndexedDB.",
    notConfigured:
      "Supabase is not configured. The app works in local mode only until you set the NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY variables.",
    syncingSession:
      "Syncing IndexedDB data with Supabase and downloading account content.",
    syncedSession: "Session synced with the cloud.",
    cloudSyncRunning: "Syncing changes to the cloud.",
    syncFailed: "Could not sync with the cloud.",
    signedInAs: "User",
  },
  forms: {
    folderTitle: "New folder",
    folderName: "Folder name",
    snippetNamePlaceholder: "Snippet name",
    folderParent: "Parent folder",
    folderPinned: "Pinned",
    snippetTitle: "New snippet",
    snippetTitlePlaceholder: "Snippet title",
    snippetName: "Title",
    snippetLanguage: "Language",
    snippetFolder: "Folder",
    snippetPinned: "Pinned",
    snippetCode: "Code",
    snippetCodePlaceholder: "Write or paste your code here...",
    submitFolder: "Create folder",
    submitSnippet: "Create snippet",
  },
  workspace: {
    loading: "Loading local content...",
    loadError: "Could not load local content.",
    rootSnippets: "Snippets at root",
    folders: "Folders",
    noFolders: "No folders created.",
    noRootSnippets: "No snippets at root.",
    emptyFolder: "This folder has no content.",
    rootOption: "Root",
    pinnedBadge: "Pinned",
  },
  snippetCard: {
    title: "Title",
    language: "Language",
    folder: "Folder",
    code: "Code",
    status: "Status",
    untitled: "Untitled",
  },
  sync: {
    editing: "Editing...",
    saving: "Saving...",
    savedLocal: "Saved locally",
    savedCloud: "Saved to the cloud",
    error: "Sync error",
    idle: "No pending changes",
  },
  aside: {
    collapse: "Collapse panel",
    open: "Open panel",
    home: "Home",
    mySpace: "My Space",
    expandFolder: "Expand folder",
    collapseFolder: "Collapse folder",
    addSnippet: "New snippet",
    addFolder: "New folder",
    emptySpace: "No files yet.",
    root: "Root",
    dropToRoot: "Move to root",
    unpin: "Unpin",
  },
  contextMenu: {
    newFolder: "New folder\u2026",
    newSnippet: "New snippet\u2026",
    pin: "Pin",
    unpin: "Unpin",
    pinHome: "Pin to Home",
    unpinHome: "Unpin from Home",
    pinAside: "Pin",
    unpinAside: "Unpin",
    rename: "Rename",
    cut: "Cut",
    copy: "Copy",
    paste: "Paste",
    delete: "Delete",
    copyContent: "Copy content",
    openInNewTab: "Open in new tab",
    moreOptions: "More options",
  },
  languageSelect: {
    searchPlaceholder: "Search language...",
    noResults: "No results",
  },
  folderSelect: {
    noFolders: "No folders",
  },
  pinnedToHome: {
    title: "Pinned to home",
  },
  folderView: {
    breadcrumbLabel: "Folder navigation",
    subFolders: "Folders",
    snippets: "Snippets",
    snippetLabel: "snippets",
    subFolderLabel: "folders",
    emptyFolder: "Empty",
    empty: "This folder is empty.",
  },
  snippetEditor: {
    back: "Back",
    titlePlaceholder: "Untitled",
    syncEditing: "Editing...",
    syncSaving: "Saving...",
    syncSavedLocal: "Saved locally",
    syncSavedCloud: "Saved to the cloud",
    syncError: "Error saving",
    syncIdle: "No changes",
    folderRoot: "Root",
    copyCode: "Copy code",
    codeCopied: "Copied!",
    formatCode: "Format code",
    formatNotSupported: "Formatting not available for this language",
  },
  confirmDeleteFolder: {
    title: "Delete folder",
    permanentWarning: "This action is permanent and cannot be undone.",
    containsFolders: (n: number) =>
      n === 1 ? "1 inner folder" : `${n} inner folders`,
    containsSnippets: (n: number) =>
      n === 1 ? "1 snippet" : `${n} snippets`,
    cancel: "Cancel",
    confirm: "Delete permanently",
  },
  landing: {
    nav: {
      openApp: "Open App",
      noSignUp: "No sign-up required",
    },
    hero: {
      title: "Your code snippets,\nalways within reach.",
      titleBefore: "Your ",
      titleHighlight: "code snippets",
      titleAfter: ",\nalways within reach.",
      subtitle:
        "Save, organize, and access your favorite code snippets instantly from any device. Cloud sync included.",
      cta: "Start now — free",
      ctaHint: "No account needed to begin",
    },
    appPreview: "KlipCode application interface",
    features: {
      title: "Everything you need, nothing you don't",
      subtitle: "Built for developers who value speed and simplicity.",
      quickSave: {
        title: "Instant Save",
        description:
          "Save a snippet in two clicks. No sign-up walls, no friction.",
      },
      instantCopy: {
        title: "One-click Copy",
        description:
          "Copy any snippet to your clipboard instantly.",
      },
      folders: {
        title: "Nested Folders",
        description:
          "Organize with hierarchical folders that match your mental model.",
      },
      dragAndDrop: {
        title: "Drag & Drop",
        description:
          "Rearrange snippets and folders by dragging them where you want.",
      },
      cloudSync: {
        title: "Cloud Sync",
        description:
          "Sign in with GitHub and sync across all your devices automatically.",
      },
      editor: {
        title: "Advanced Editor",
        description:
          "Syntax highlighting, auto-save, code formatting — all built in.",
      },
    },
    demos: {
      create: {
        title: "Create snippets in seconds",
        description:
          "Pick a language, paste your code — done. No configuration required.",
      },
      copy: {
        title: "Copy with one click",
        description:
          "Every snippet is one click away from your clipboard.",
      },
      move: {
        title: "Organize intuitively",
        description:
          "Drag and drop to rearrange your entire workspace.",
      },
    },
    cta: {
      title: "Ready to organize your code?",
      subtitle:
        "Start using KlipCode right now. No account, no setup, no limits.",
      button: "Launch KlipCode",
    },
    footer: {
      tagline: "Multi-device snippet manager.",
      source: "Source",
    },
  },
  seed: {
    folderName: "welcome",
    snippetName: "klipcode",
    snippetContent: WELCOME_SNIPPET_CONTENT,
  },
} as const;
