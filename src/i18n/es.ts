const WELCOME_SNIPPET_CONTENT = `# ¡Bienvenido a KlipCode!

KlipCode es una herramienta diseñada para mantener tus fragmentos de código favoritos siempre a mano,
de forma rápida y sencilla, en todos tus dispositivos.

## ¿Qué puedes hacer?

- **Guardado rápido:** Registra un *snippet* en un par de clics sin necesidad de iniciar sesión.
- **Copiado ágil:** Copia el contenido de tus fragmentos al portapapeles instantáneamente.
- **Organización jerárquica:** Crea carpetas con distintos niveles de profundidad para organizar tu código.
- **Gestión intuitiva:** Mueve tus *snippets* y carpetas arrastrándolos para que se adapten a tu flujo de trabajo.
- **Sincronización con GitHub:** Inicia sesión para que tus datos se sincronicen automáticamente en la nube.
- **Editor avanzado:** Edita tus fragmentos cómodamente con un sistema de guardado automático.
- **Acceso prioritario:** Fija tus *snippets* más importantes tanto en carpetas como en la página de inicio.

## Primeros pasos

1. **Crea tu primer snippet:** Utiliza el creador de la página de inicio o el botón
   de la barra lateral para añadir este código JSX en la raíz con el título \`Componente\`:

\`\`\`
const Greet = ({ name }) => {
  return (
    <div className="user-card">
      <h1>{name}</h1>
      <button onClick={() => console.log(\`Hola \${name}\`)}>
        Click
      </button>
    </div>
  );
};
\`\`\`

2. **Abre el editor:** Pulsa sobre el archivo creado en la barra lateral.
3. **Organiza el contenido:** Crea una carpeta llamada \`mis-componentes\` desde la barra lateral
   y arrastra tu nuevo componente dentro.
4. **¡Listo!:** Ya puedes empezar a explorar KlipCode para potenciar tu productividad.
   Puedes borrar todos los snippets y carpetas de ejemplo si quieres, simplemente haz clic derecho sobre
   ellos en la barra lateral y selecciona "Eliminar".`;
export const es = {
  app: {
    title: "KlipCode",
    subtitle: "Gestor de snippets multidispositivo.",
  },
  auth: {
    statusLabel: "Estado de sesión",
    signedIn: "Sesión iniciada",
    signedOut: "Sin sesión",
    signIn: "Iniciar Sesión",
    signOut: "Cerrar sesión",
    localMode: "Modo local activo. Los cambios se guardan en IndexedDB.",
    notConfigured:
      "Supabase no esta configurado. La aplicacion funciona solo en local hasta definir las variables NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY.",
    syncingSession:
      "Sincronizando los datos de IndexedDB con Supabase y descargando el contenido de la cuenta.",
    syncedSession: "Sesión sincronizada con la nube.",
    cloudSyncRunning: "Sincronizando cambios con la nube.",
    syncFailed: "No se pudo sincronizar con la nube.",
    signedInAs: "Usuario",
  },
  forms: {
    folderTitle: "Nueva carpeta",
    folderName: "Nombre de la carpeta",
    snippetNamePlaceholder: "Nombre del snippet",
    folderParent: "Carpeta padre",
    folderPinned: "Fijada",
    snippetTitle: "Nuevo snippet",
    snippetTitlePlaceholder: "Titulo del snippet",
    snippetName: "Titulo",
    snippetLanguage: "Lenguaje",
    snippetFolder: "Carpeta",
    snippetPinned: "Fijado",
    snippetCode: "Codigo",
    snippetCodePlaceholder: "Escribe o pega tu codigo aqui...",
    submitFolder: "Crear carpeta",
    submitSnippet: "Crear snippet",
  },
  workspace: {
    loading: "Cargando contenido local...",
    loadError: "No se pudo cargar el contenido local.",
    rootSnippets: "Snippets en la raiz",
    folders: "Carpetas",
    noFolders: "No hay carpetas creadas.",
    noRootSnippets: "No hay snippets en la raiz.",
    emptyFolder: "Esta carpeta no tiene contenido.",
    rootOption: "Raiz",
    pinnedBadge: "Fijado",
  },
  snippetCard: {
    title: "Titulo",
    language: "Lenguaje",
    folder: "Carpeta",
    code: "Codigo",
    status: "Estado",
    untitled: "Sin titulo",
  },
  sync: {
    editing: "Cambiando...",
    saving: "Guardando...",
    savedLocal: "Guardado en local",
    savedCloud: "Guardado en la nube",
    error: "Error de sincronizacion",
    idle: "Sin cambios pendientes",
  },
  aside: {
    collapse: "Colapsar panel",
    open: "Abrir panel",
    home: "Inicio",
    mySpace: "Mi Espacio",
    expandFolder: "Expandir carpeta",
    collapseFolder: "Contraer carpeta",
    addSnippet: "Nuevo snippet",
    addFolder: "Nueva carpeta",
    emptySpace: "No hay archivos todavia.",
    root: "Raiz",
    dropToRoot: "Mover a raíz",
    unpin: "Desfijar",
  },
  contextMenu: {
    newFolder: "Nueva carpeta\u2026",
    newSnippet: "Nuevo snippet\u2026",
    pin: "Fijar",
    unpin: "Desfijar",
    pinHome: "Fijar en Inicio",
    unpinHome: "Desfijar de Inicio",
    pinAside: "Fijar",
    unpinAside: "Desfijar",
    rename: "Renombrar",
    cut: "Cortar",
    copy: "Copiar",
    paste: "Pegar",
    delete: "Eliminar",
    copyContent: "Copiar contenido",
    openInNewTab: "Abrir en nueva pestaña",
    moreOptions: "Más opciones",
  },
  languageSelect: {
    searchPlaceholder: "Buscar lenguaje...",
    noResults: "Sin resultados",
  },
  folderSelect: {
    noFolders: "Sin carpetas",
  },
  pinnedToHome: {
    title: "Fijados en inicio",
  },
  folderView: {
    breadcrumbLabel: "Navegación de carpetas",
    subFolders: "Carpetas",
    snippets: "Snippets",
    snippetLabel: "snippets",
    subFolderLabel: "carpetas",
    emptyFolder: "Vacío",
    empty: "Esta carpeta está vacía.",
  },
  snippetEditor: {
    back: "Volver",
    titlePlaceholder: "Sin título",
    syncEditing: "Cambiando...",
    syncSaving: "Guardando...",
    syncSavedLocal: "Guardado en local",
    syncSavedCloud: "Guardado en la nube",
    syncError: "Error al guardar",
    syncIdle: "Sin cambios",
    folderRoot: "Raiz",
    copyCode: "Copiar código",
    codeCopied: "¡Copiado!",
    formatCode: "Formatear código",
    formatNotSupported: "Formateo no disponible para este lenguaje",
  },
  confirmDeleteFolder: {
    title: "Eliminar carpeta",
    permanentWarning: "Esta acción es permanente y no se puede deshacer.",
    containsFolders: (n: number) =>
      n === 1 ? "1 carpeta interna" : `${n} carpetas internas`,
    containsSnippets: (n: number) =>
      n === 1 ? "1 snippet" : `${n} snippets`,
    cancel: "Cancelar",
    confirm: "Eliminar permanentemente",
  },
  landing: {
    nav: {
      openApp: "Abrir App",
      noSignUp: "Sin necesidad de registro",
    },
    hero: {
      title: "Tus snippets de código,\nsiempre a mano.",
      titleBefore: "Tus ",
      titleHighlight: "snippets de código",
      titleAfter: ",\nsiempre a mano.",
      subtitle:
        "Guarda, organiza y accede a tus fragmentos de código favoritos al instante desde cualquier dispositivo. Sincronización en la nube incluida.",
      cta: "Empieza ahora — gratis",
      ctaHint: "No necesitas cuenta para empezar",
    },
    appPreview: "Interfaz de la aplicación KlipCode",
    features: {
      title: "Todo lo que necesitas, nada que sobre",
      subtitle: "Diseñado para desarrolladores que valoran la velocidad y la simplicidad.",
      quickSave: {
        title: "Guardado instantáneo",
        description:
          "Guarda un snippet en dos clics. Sin formularios, sin fricción.",
      },
      instantCopy: {
        title: "Copia en un clic",
        description:
          "Copia cualquier snippet al portapapeles al instante.",
      },
      folders: {
        title: "Carpetas anidadas",
        description:
          "Organiza con carpetas jerárquicas que se adaptan a tu modelo mental.",
      },
      dragAndDrop: {
        title: "Arrastrar y soltar",
        description:
          "Reorganiza snippets y carpetas arrastrándolos donde quieras.",
      },
      cloudSync: {
        title: "Sincronización en la nube",
        description:
          "Inicia sesión con GitHub y sincroniza todos tus dispositivos automáticamente.",
      },
      editor: {
        title: "Editor avanzado",
        description:
          "Resaltado de sintaxis, guardado automático, formateo — todo integrado.",
      },
    },
    demos: {
      create: {
        title: "Crea snippets en segundos",
        description:
          "Elige un lenguaje, pega tu código — listo. Sin configuración.",
      },
      copy: {
        title: "Copia con un clic",
        description:
          "Cada snippet está a un clic de tu portapapeles.",
      },
      move: {
        title: "Organiza intuitivamente",
        description:
          "Arrastra y suelta para reorganizar todo tu espacio de trabajo.",
      },
    },
    cta: {
      title: "¿Listo para organizar tu código?",
      subtitle:
        "Empieza a usar KlipCode ahora mismo. Sin cuenta, sin configuración, sin límites.",
      button: "Abrir KlipCode",
    },
    footer: {
      tagline: "Gestor de snippets multidispositivo.",
      source: "Código fuente",
    },
  },
  seed: {
    folderName: "bienvenido",
    snippetName: "klipcode",
    snippetContent: WELCOME_SNIPPET_CONTENT,
  },
} as const;