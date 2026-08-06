const WELCOME_SNIPPET_CONTENT = `# Welcome to KlipCode!

KlipCode is a tool designed to keep your favorite code snippets always at hand,
quickly and easily, across all your devices.

## What can you do?

- **Quick save:** Save a *snippet* in a couple of clicks without needing to sign in.
- **Instant copy:** Copy the content of your snippets to the clipboard instantly.
- **Hierarchical organization:** Create folders with multiple depth levels to organize your code.
- **Intuitive management:** Move your *snippets* and folders by dragging them to fit your workflow.
- **Cloud library:** Sign in with GitHub to keep your data automatically synced across devices.
- **Advanced editor:** Edit your snippets comfortably with an auto-save system.
- **Priority access:** Pin your most important *snippets* both in folders and on the home page.

## Getting started

1. **Create your first snippet:** Use the creator on the home page or the button
   in the sidebar to add this JSX code at the root level with the title \`Component\`:

\`\`\`jsx
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
  common: {
    close: "Close",
    skipToContent: "Skip to main content",
  },
  auth: {
    statusLabel: "Session status",
    signedIn: "Signed in",
    signedOut: "Signed out",
    signIn: "Sign In",
    signOut: "Sign Out",
    guestMode: "Guest workspace. Changes are saved only on this device.",
    notConfigured:
      "Cloud storage is unavailable until NEXT_PUBLIC_CONVEX_URL is configured. Changes remain on this device.",
    syncingSession:
      "Uploading this device's snippets and downloading your cloud library.",
    syncedSession: "Session synced with the cloud.",
    cloudSyncRunning: "Syncing changes to the cloud.",
    syncFailed: "Could not sync with the cloud.",
    signedInAs: "User",
    signingIn: "Signing in…",
    signingOut: "Signing out…",
  },
  forms: {
    folderTitle: "New folder",
    folderName: "Folder name or path",
    snippetNamePlaceholder: "Name or path, e.g. scripts/index.js",
    folderParent: "Parent folder",
    folderPinned: "Pinned",
    snippetTitle: "New snippet",
    snippetTitlePlaceholder: "Snippet title",
    snippetName: "Title",
    snippetLanguage: "Language",
    snippetFolder: "Folder",
    snippetPinned: "Pinned",
    snippetCode: "Code",
    codeEditor: "Code editor",
    snippetCodePlaceholder: "Write or paste your code here...",
    submitFolder: "Create folder",
    submitSnippet: "Create snippet",
    snippetCreated: "Snippet created",
    open: "Open",
  },
  workspace: {
    loading: "Loading your snippets...",
    loadError: "Could not load your snippets.",
    rootSnippets: "Snippets at root",
    folders: "Folders",
    noFolders: "No folders created.",
    noRootSnippets: "No snippets at root.",
    emptyFolder: "This folder has no content.",
    rootOption: "Root",
    pinnedBadge: "Pinned",
    snippetNotFoundTitle: "Snippet not found",
    snippetNotFoundDescription: "This snippet doesn't exist or has been deleted.",
  },
  snippetCard: {
    title: "Title",
    language: "Language",
    folder: "Folder",
    code: "Code",
    status: "Status",
    untitled: "Untitled",
    generatingTitle: "Naming snippet…",
  },
  sync: {
    editing: "Editing...",
    saving: "Saving...",
    savedLocal: "Saved on this device",
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
    dropToTrash: "Move to trash",
    unpin: "Unpin",
    pinned: "Pinned",
    search: "Search",
    shortcuts: "Keyboard shortcuts",
    preferences: "Preferences",
    trash: "Trash",
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
    restore: "Restore",
    deletePermanently: "Delete permanently",
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
  recentSnippets: {
    title: "Recently edited",
    empty: "You don't have any snippets yet. Create your first one above.",
  },
  folderView: {
    breadcrumbLabel: "Folder navigation",
    subFolders: "Folders",
    snippets: "Snippets",
    folderCount: (n: number) => (n === 1 ? "1 folder" : `${n} folders`),
    snippetCount: (n: number) => (n === 1 ? "1 snippet" : `${n} snippets`),
    emptyFolder: "Empty",
    empty: "This folder is empty.",
  },
  snippetEditor: {
    back: "Back",
    titlePlaceholder: "Untitled",
    generatingTitle: "Naming snippet…",
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
    formatError: "Couldn't format — check for syntax errors",
    mdCodeBlockOptions: "Code block options",
    mdCodeBlockDelete: "Delete block",
    previewMarkdown: "Rich text view",
    editMarkdown: "Markdown source",
    mdPlaceholder: "Write something… Markdown shortcuts work here.",
    trashedNotice: "This snippet is in the trash — restore it to edit.",
    linkDialog: {
      title: "Insert link",
      editTitle: "Edit link",
      label: "URL",
      placeholder: "https://",
      apply: "Apply",
      cancel: "Cancel",
      remove: "Remove link",
      invalid: "Enter a valid URL",
    },
    mdToolbar: {
      bold: "Bold",
      italic: "Italic",
      strike: "Strikethrough",
      code: "Inline code",
      heading1: "Heading 1",
      heading2: "Heading 2",
      heading3: "Heading 3",
      bulletList: "Bullet list",
      orderedList: "Numbered list",
      taskList: "Task list",
      codeBlock: "Code block",
      quote: "Quote",
      link: "Link",
    },
    mdSlash: {
      group: "Basic blocks",
      noResults: "No blocks found",
      heading1Title: "Heading 1",
      heading1Desc: "Big section heading",
      heading2Title: "Heading 2",
      heading2Desc: "Medium section heading",
      heading3Title: "Heading 3",
      heading3Desc: "Small section heading",
      bulletListTitle: "Bullet list",
      bulletListDesc: "A simple bulleted list",
      orderedListTitle: "Numbered list",
      orderedListDesc: "A list with numbering",
      taskListTitle: "Task list",
      taskListDesc: "Track tasks with checkboxes",
      blockquoteTitle: "Quote",
      blockquoteDesc: "Capture a quotation",
      codeBlockTitle: "Code block",
      codeBlockDesc: "Code with syntax highlighting",
      tableTitle: "Table",
      tableDesc: "Insert a 3×3 table",
      dividerTitle: "Divider",
      dividerDesc: "Visually separate sections",
    },
    mdTable: {
      addColumnBefore: "Add column before",
      addColumnAfter: "Add column after",
      deleteColumn: "Delete column",
      addRowBefore: "Add row above",
      addRowAfter: "Add row below",
      deleteRow: "Delete row",
      toggleHeaderRow: "Toggle header row",
      deleteTable: "Delete table",
    },
  },
  search: {
    placeholder: "Search snippets by title or code…",
    empty: "Type to search your snippets",
    noResults: "No snippets found",
    /** Screen-reader-only announcement of how many results the query matched. */
    resultCount: (n: number) => (n === 1 ? "1 snippet found" : `${n} snippets found`),
    rootFolder: "Root",
    navigateHint: "to navigate",
    selectHint: "to open",
    closeHint: "to close",
  },
  shortcuts: {
    title: "Keyboard shortcuts",
    sections: {
      general: "General",
      editor: "Editor",
      navigation: "Navigation",
    },
    items: {
      search: "Open search",
      newSnippet: "New snippet",
      createSnippet: "Create snippet",
      toggleSidebar: "Toggle sidebar",
      help: "Show keyboard shortcuts",
      copyCurrent: "Copy current snippet code",
      closeEditor: "Close editor",
      undoDelete: "Undo last delete",
      navigateList: "Move between cards",
    },
  },
  preferences: {
    title: "Preferences",
    appearance: {
      label: "Appearance",
      description: "Light or dark theme",
      light: "Light",
      dark: "Dark",
      toLight: "Switch to light theme",
      toDark: "Switch to dark theme",
    },
    language: {
      label: "Language",
      description: "Interface language",
      en: "English",
      es: "Español",
    },
    defaultFolder: {
      label: "Default folder",
      description: "Pre-selected folder when creating a snippet",
    },
    defaultLanguage: {
      label: "Default language",
      description: "Pre-selected language when creating a snippet",
    },
    autoGenerateTitle: {
      label: "Auto-generate names",
      description: "Name untitled snippets automatically with AI",
      lockedHint: "Sign in to name snippets automatically with AI",
    },
    codeWrap: {
      label: "Long lines",
      description: "Scroll horizontally or wrap onto the next line",
      scroll: "Scroll",
      wrap: "Wrap",
    },
  },
  trash: {
    title: "Trash",
    empty: "The trash is empty.",
    restore: "Restore",
    deletePermanently: "Delete permanently",
    restoreAll: "Restore all",
    emptyTrash: "Empty trash",
    emptyTitle: "Empty trash",
    emptyWarning: "This permanently deletes everything in the trash. This action cannot be undone.",
    cancel: "Cancel",
    undoRestored: "Deletion undone",
    folderCount: (n: number) => (n === 1 ? "1 folder" : `${n} folders`),
    snippetCount: (n: number) => (n === 1 ? "1 snippet" : `${n} snippets`),
  },
  landing: {
    nav: {
      openApp: "Open App",
      noSignUp: "No account needed to start",
      features: "Features",
      faq: "FAQ",
    },
    hero: {
      badge: "Free · Open source · Start instantly",
      title: "The code snippet manager\nthat stays out of your way.",
      titleBefore: "The ",
      titleHighlight: "code snippet manager",
      titleAfter: "that stays out of your way.",
      subtitle:
        "Save, organize, and copy your code snippets wherever you work. Start without an account, then sign in with GitHub to keep your library synced across every device.",
      cta: "Start now — free",
      ctaHint: "No account needed to begin",
    },
    trust: {
      anywhere: "Available on every device",
      guest: "Start without an account",
      openSource: "Open source on GitHub",
    },
    appPreview:
      "KlipCode snippet manager interface: folder sidebar and code editor with syntax highlighting",
    features: {
      eyebrow: "Features",
      title: "Everything you need, nothing you don't",
      subtitle: "Built for developers who value speed and simplicity.",
      quickSave: {
        title: "Instant Save",
        description:
          "Save a code snippet in two clicks. No sign-up walls, no friction.",
      },
      instantCopy: {
        title: "One-click Copy",
        description:
          "Copy any snippet to your clipboard instantly — no more digging through old projects and gists.",
      },
      folders: {
        title: "Nested Folders",
        description:
          "Organize your snippet library with hierarchical folders that match your mental model.",
      },
      dragAndDrop: {
        title: "Drag & Drop",
        description:
          "Rearrange snippets and folders by dragging them where you want.",
      },
      cloudSync: {
        title: "Secure Cloud Sync",
        description:
          "Sign in with GitHub to save your library to KlipCode and keep it synchronized across all your devices.",
      },
      editor: {
        title: "Advanced Code Editor",
        description:
          "Syntax highlighting for 25+ languages, auto-save, and code formatting — all built in.",
      },
    },
    demos: {
      eyebrow: "How it works",
      title: "From paste to copy in seconds",
      subtitle:
        "No setup, no configuration. Open the app and start saving code snippets.",
      create: {
        title: "Create snippets in seconds",
        description:
          "Pick a language, paste your code — done. Syntax highlighting and auto-save are built in.",
      },
      copy: {
        title: "Copy with one click",
        description:
          "Every snippet is one click away from your clipboard, on every device.",
      },
      move: {
        title: "Organize intuitively",
        description:
          "Drag and drop snippets and folders to arrange your workspace the way you think.",
      },
    },
    faq: {
      eyebrow: "FAQ",
      title: "Frequently asked questions",
      subtitle: "Everything you might want to know before you start.",
      items: [
        {
          q: "Is KlipCode free?",
          a: "Yes — KlipCode is completely free and open source. There are no paid plans or snippet limits, and you can get started without an account.",
        },
        {
          q: "Do I need an account to use KlipCode?",
          a: "Not to get started. Without an account, your guest workspace stays on the current device. Sign in with GitHub to save your library to KlipCode and access it everywhere.",
        },
        {
          q: "Where are my snippets stored?",
          a: "A guest workspace is stored on the device where you create it. After you sign in, KlipCode securely stores and synchronizes your library in the cloud.",
        },
        {
          q: "How do I sync snippets across devices?",
          a: "Sign in with GitHub on each device. Your snippet library is backed up to the cloud and kept in sync automatically — edits on one device appear on the others.",
        },
        {
          q: "Is my code private?",
          a: "Your cloud library belongs to your authenticated account and cannot be accessed by other users. Guest snippets remain on the device where you created them, and the entire codebase is open source so you can verify how it works.",
        },
        {
          q: "Which programming languages are supported?",
          a: "KlipCode highlights more than 25 languages — JavaScript, TypeScript, Python, Go, Rust, SQL, HTML, CSS, and more — plus a rich Markdown mode for notes and docs.",
        },
      ],
    },
    cta: {
      title: "Ready to organize your code?",
      subtitle:
        "Free, open source, and ready in seconds. Start without an account, then take your library everywhere.",
      button: "Launch KlipCode",
    },
    footer: {
      tagline: "Your code snippets, available everywhere.",
      description:
        "KlipCode is a free, open-source code snippet manager. Start instantly, then sign in with GitHub to securely save and sync your library across all your devices.",
      source: "Source",
      product: "Product",
      language: "Language",
      github: "GitHub",
    },
  },
  error: {
    title: "Something went wrong",
    description: "An unexpected error occurred. You can try again.",
    retry: "Try again",
  },
  notFound: {
    title: "Page not found",
    description: "The page you're looking for doesn't exist or has been moved.",
    backHome: "Back to home",
  },
  meta: {
    home: {
      title: "KlipCode — Cloud Code Snippet Manager",
      description:
        "Save, organize, and copy code snippets with KlipCode, the free open-source snippet manager. Start without an account and sync your library across devices.",
    },
    app: {
      title: "Cloud Snippet Manager App",
      description:
        "Create, organize, and copy code snippets instantly. Sign in with GitHub to save your KlipCode library and keep it synchronized across devices.",
    },
  },
  seed: {
    folderName: "welcome",
    snippetName: "klipcode",
    snippetContent: WELCOME_SNIPPET_CONTENT,
  },
} as const;
