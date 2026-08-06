import type { Dictionary } from "@/i18n";

const WELCOME_SNIPPET_CONTENT = `# ¡Bienvenido a KlipCode!

KlipCode es una herramienta diseñada para mantener tus fragmentos de código favoritos siempre a mano,
de forma rápida y sencilla, en todos tus dispositivos.

## ¿Qué puedes hacer?

- **Guardado rápido:** Registra un *snippet* en un par de clics sin necesidad de iniciar sesión.
- **Copiado ágil:** Copia el contenido de tus fragmentos al portapapeles instantáneamente.
- **Organización jerárquica:** Crea carpetas con distintos niveles de profundidad para organizar tu código.
- **Gestión intuitiva:** Mueve tus *snippets* y carpetas arrastrándolos para que se adapten a tu flujo de trabajo.
- **Biblioteca en la nube:** Inicia sesión con GitHub para mantener tus datos sincronizados automáticamente entre dispositivos.
- **Editor avanzado:** Edita tus fragmentos cómodamente con un sistema de guardado automático.
- **Acceso prioritario:** Fija tus *snippets* más importantes tanto en carpetas como en la página de inicio.

## Primeros pasos

1. **Crea tu primer snippet:** Utiliza el creador de la página de inicio o el botón
   de la barra lateral para añadir este código JSX en la raíz con el título \`Componente\`:

\`\`\`jsx
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
  common: {
    close: "Cerrar",
    skipToContent: "Saltar al contenido principal",
  },
  auth: {
    statusLabel: "Estado de sesión",
    signedIn: "Sesión iniciada",
    signedOut: "Sin sesión",
    signIn: "Iniciar Sesión",
    signOut: "Cerrar sesión",
    guestMode: "Espacio de invitado. Los cambios se guardan solo en este dispositivo.",
    notConfigured:
      "El almacenamiento en la nube no está disponible hasta configurar NEXT_PUBLIC_CONVEX_URL. Los cambios permanecen en este dispositivo.",
    syncingSession:
      "Subiendo los snippets de este dispositivo y descargando tu biblioteca de la nube.",
    syncedSession: "Sesión sincronizada con la nube.",
    cloudSyncRunning: "Sincronizando cambios con la nube.",
    syncFailed: "No se pudo sincronizar con la nube.",
    signedInAs: "Usuario",
    signingIn: "Iniciando sesión…",
    signingOut: "Cerrando sesión…",
  },
  forms: {
    folderTitle: "Nueva carpeta",
    folderName: "Nombre o ruta de la carpeta",
    snippetNamePlaceholder: "Nombre o ruta, p. ej. scripts/index.js",
    folderParent: "Carpeta padre",
    folderPinned: "Fijada",
    snippetTitle: "Nuevo snippet",
    snippetTitlePlaceholder: "Titulo del snippet",
    snippetName: "Titulo",
    snippetLanguage: "Lenguaje",
    snippetFolder: "Carpeta",
    snippetPinned: "Fijado",
    snippetCode: "Codigo",
    codeEditor: "Editor de codigo",
    snippetCodePlaceholder: "Escribe o pega tu codigo aqui...",
    submitFolder: "Crear carpeta",
    submitSnippet: "Crear snippet",
    snippetCreated: "Snippet creado",
    open: "Abrir",
  },
  workspace: {
    loading: "Cargando tus snippets...",
    loadError: "No se pudieron cargar tus snippets.",
    rootSnippets: "Snippets en la raiz",
    folders: "Carpetas",
    noFolders: "No hay carpetas creadas.",
    noRootSnippets: "No hay snippets en la raiz.",
    emptyFolder: "Esta carpeta no tiene contenido.",
    rootOption: "Raiz",
    pinnedBadge: "Fijado",
    snippetNotFoundTitle: "Snippet no encontrado",
    snippetNotFoundDescription: "Este snippet no existe o ha sido eliminado.",
  },
  snippetCard: {
    title: "Titulo",
    language: "Lenguaje",
    folder: "Carpeta",
    code: "Codigo",
    status: "Estado",
    untitled: "Sin titulo",
    generatingTitle: "Nombrando snippet…",
  },
  sync: {
    editing: "Cambiando...",
    saving: "Guardando...",
    savedLocal: "Guardado en este dispositivo",
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
    dropToTrash: "Mover a la papelera",
    unpin: "Desfijar",
    pinned: "Fijado",
    search: "Buscar",
    shortcuts: "Atajos de teclado",
    preferences: "Preferencias",
    trash: "Papelera",
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
    restore: "Restaurar",
    deletePermanently: "Eliminar definitivamente",
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
  recentSnippets: {
    title: "Editados recientemente",
    empty: "Aún no tienes snippets. Crea tu primero arriba.",
  },
  folderView: {
    breadcrumbLabel: "Navegación de carpetas",
    subFolders: "Carpetas",
    snippets: "Snippets",
    folderCount: (n: number) => (n === 1 ? "1 carpeta" : `${n} carpetas`),
    snippetCount: (n: number) => (n === 1 ? "1 snippet" : `${n} snippets`),
    emptyFolder: "Vacío",
    empty: "Esta carpeta está vacía.",
  },
  snippetEditor: {
    back: "Volver",
    titlePlaceholder: "Sin título",
    generatingTitle: "Nombrando snippet…",
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
    formatError: "No se pudo formatear — revisa la sintaxis",
    mdCodeBlockOptions: "Opciones del bloque",
    mdCodeBlockDelete: "Eliminar bloque",
    previewMarkdown: "Vista de texto enriquecido",
    editMarkdown: "Código Markdown",
    mdPlaceholder: "Escribe algo… Los atajos de Markdown funcionan aquí.",
    trashedNotice: "Este snippet está en la papelera; restáuralo para editarlo.",
    linkDialog: {
      title: "Insertar enlace",
      editTitle: "Editar enlace",
      label: "URL",
      placeholder: "https://",
      apply: "Aplicar",
      cancel: "Cancelar",
      remove: "Quitar enlace",
      invalid: "Introduce una URL válida",
    },
    mdToolbar: {
      bold: "Negrita",
      italic: "Cursiva",
      strike: "Tachado",
      code: "Código en línea",
      heading1: "Encabezado 1",
      heading2: "Encabezado 2",
      heading3: "Encabezado 3",
      bulletList: "Lista con viñetas",
      orderedList: "Lista numerada",
      taskList: "Lista de tareas",
      codeBlock: "Bloque de código",
      quote: "Cita",
      link: "Enlace",
    },
    mdSlash: {
      group: "Bloques básicos",
      noResults: "No hay bloques",
      heading1Title: "Encabezado 1",
      heading1Desc: "Título de sección grande",
      heading2Title: "Encabezado 2",
      heading2Desc: "Título de sección mediano",
      heading3Title: "Encabezado 3",
      heading3Desc: "Título de sección pequeño",
      bulletListTitle: "Lista con viñetas",
      bulletListDesc: "Una lista con viñetas simple",
      orderedListTitle: "Lista numerada",
      orderedListDesc: "Una lista con numeración",
      taskListTitle: "Lista de tareas",
      taskListDesc: "Controla tareas con casillas",
      blockquoteTitle: "Cita",
      blockquoteDesc: "Resalta una cita",
      codeBlockTitle: "Bloque de código",
      codeBlockDesc: "Código con resaltado de sintaxis",
      tableTitle: "Tabla",
      tableDesc: "Inserta una tabla de 3×3",
      dividerTitle: "Separador",
      dividerDesc: "Separa secciones visualmente",
    },
    mdTable: {
      addColumnBefore: "Añadir columna antes",
      addColumnAfter: "Añadir columna después",
      deleteColumn: "Eliminar columna",
      addRowBefore: "Añadir fila arriba",
      addRowAfter: "Añadir fila abajo",
      deleteRow: "Eliminar fila",
      toggleHeaderRow: "Alternar fila de encabezado",
      deleteTable: "Eliminar tabla",
    },
  },
  search: {
    placeholder: "Buscar snippets por título o código…",
    empty: "Escribe para buscar tus snippets",
    noResults: "No se encontraron snippets",
    /** Anuncio solo para lectores de pantalla del número de resultados. */
    resultCount: (n: number) => (n === 1 ? "1 snippet encontrado" : `${n} snippets encontrados`),
    rootFolder: "Raíz",
    navigateHint: "para navegar",
    selectHint: "para abrir",
    closeHint: "para cerrar",
  },
  shortcuts: {
    title: "Atajos de teclado",
    sections: {
      general: "General",
      editor: "Editor",
      navigation: "Navegación",
    },
    items: {
      search: "Abrir búsqueda",
      newSnippet: "Nuevo snippet",
      createSnippet: "Crear snippet",
      toggleSidebar: "Alternar barra lateral",
      help: "Mostrar atajos de teclado",
      copyCurrent: "Copiar el código del snippet actual",
      closeEditor: "Cerrar editor",
      undoDelete: "Deshacer el último borrado",
      navigateList: "Moverse entre tarjetas",
    },
  },
  preferences: {
    title: "Preferencias",
    appearance: {
      label: "Apariencia",
      description: "Tema claro u oscuro",
      light: "Claro",
      dark: "Oscuro",
      toLight: "Cambiar a tema claro",
      toDark: "Cambiar a tema oscuro",
    },
    language: {
      label: "Idioma",
      description: "Idioma de la interfaz",
      en: "English",
      es: "Español",
    },
    defaultFolder: {
      label: "Carpeta por defecto",
      description: "Carpeta preseleccionada al crear un snippet",
    },
    defaultLanguage: {
      label: "Lenguaje por defecto",
      description: "Lenguaje preseleccionado al crear un snippet",
    },
    autoGenerateTitle: {
      label: "Generar nombres automáticamente",
      description: "Nombra los snippets sin título automáticamente con IA",
      lockedHint: "Inicia sesión para nombrar snippets automáticamente con IA",
    },
    codeWrap: {
      label: "Líneas largas",
      description: "Scroll horizontal o ajustar a la línea siguiente",
      scroll: "Scroll",
      wrap: "Ajustar",
    },
  },
  trash: {
    title: "Papelera",
    empty: "La papelera está vacía.",
    restore: "Restaurar",
    deletePermanently: "Eliminar definitivamente",
    restoreAll: "Restaurar todo",
    emptyTrash: "Vaciar papelera",
    emptyTitle: "Vaciar papelera",
    emptyWarning: "Esto elimina definitivamente todo el contenido de la papelera. Esta acción no se puede deshacer.",
    cancel: "Cancelar",
    undoRestored: "Borrado deshecho",
    folderCount: (n: number) => (n === 1 ? "1 carpeta" : `${n} carpetas`),
    snippetCount: (n: number) => (n === 1 ? "1 snippet" : `${n} snippets`),
  },
  landing: {
    nav: {
      openApp: "Abrir App",
      noSignUp: "Empieza sin crear una cuenta",
      features: "Características",
      faq: "FAQ",
    },
    hero: {
      badge: "Gratis · Open source · Empieza al instante",
      title: "El gestor de snippets\nque no te frena.",
      titleBefore: "El ",
      titleHighlight: "gestor de snippets",
      titleAfter: "que no te frena.",
      subtitle:
        "Guarda, organiza y copia tus snippets de código estés donde estés. Empieza sin crear una cuenta e inicia sesión con GitHub para mantener tu biblioteca sincronizada en todos tus dispositivos.",
      cta: "Empieza ahora — gratis",
      ctaHint: "No necesitas cuenta para empezar",
    },
    trust: {
      anywhere: "Disponible en todos tus dispositivos",
      guest: "Empieza sin crear una cuenta",
      openSource: "Código abierto en GitHub",
    },
    appPreview:
      "Interfaz del gestor de snippets KlipCode: barra lateral de carpetas y editor de código con resaltado de sintaxis",
    features: {
      eyebrow: "Características",
      title: "Todo lo que necesitas, nada que sobre",
      subtitle: "Diseñado para desarrolladores que valoran la velocidad y la simplicidad.",
      quickSave: {
        title: "Guardado instantáneo",
        description:
          "Guarda un snippet de código en dos clics. Sin formularios, sin fricción.",
      },
      instantCopy: {
        title: "Copia en un clic",
        description:
          "Copia cualquier snippet al portapapeles al instante — se acabó rebuscar en proyectos antiguos y gists.",
      },
      folders: {
        title: "Carpetas anidadas",
        description:
          "Organiza tu biblioteca de snippets con carpetas jerárquicas que se adaptan a tu modelo mental.",
      },
      dragAndDrop: {
        title: "Arrastrar y soltar",
        description:
          "Reorganiza snippets y carpetas arrastrándolos donde quieras.",
      },
      cloudSync: {
        title: "Sincronización segura en la nube",
        description:
          "Inicia sesión con GitHub para guardar tu biblioteca en KlipCode y mantenerla sincronizada en todos tus dispositivos.",
      },
      editor: {
        title: "Editor de código avanzado",
        description:
          "Resaltado de sintaxis para más de 25 lenguajes, guardado automático y formateo — todo integrado.",
      },
    },
    demos: {
      eyebrow: "Cómo funciona",
      title: "De pegar a copiar en segundos",
      subtitle:
        "Sin configuración ni ajustes. Abre la app y empieza a guardar snippets de código.",
      create: {
        title: "Crea snippets en segundos",
        description:
          "Elige un lenguaje, pega tu código — listo. Resaltado de sintaxis y guardado automático integrados.",
      },
      copy: {
        title: "Copia con un clic",
        description:
          "Cada snippet está a un clic de tu portapapeles, en cualquier dispositivo.",
      },
      move: {
        title: "Organiza intuitivamente",
        description:
          "Arrastra y suelta snippets y carpetas para ordenar tu espacio de trabajo como tú piensas.",
      },
    },
    faq: {
      eyebrow: "FAQ",
      title: "Preguntas frecuentes",
      subtitle: "Todo lo que quieras saber antes de empezar.",
      items: [
        {
          q: "¿KlipCode es gratis?",
          a: "Sí — KlipCode es totalmente gratuito y de código abierto. No hay planes de pago ni límites de snippets, y puedes empezar sin crear una cuenta.",
        },
        {
          q: "¿Necesito una cuenta para usar KlipCode?",
          a: "No para empezar. Sin cuenta, tu espacio de invitado permanece en el dispositivo actual. Inicia sesión con GitHub para guardar tu biblioteca en KlipCode y acceder a ella desde cualquier lugar.",
        },
        {
          q: "¿Dónde se guardan mis snippets?",
          a: "El espacio de invitado se guarda en el dispositivo donde lo creas. Cuando inicias sesión, KlipCode guarda y sincroniza de forma segura tu biblioteca en la nube.",
        },
        {
          q: "¿Cómo sincronizo snippets entre dispositivos?",
          a: "Inicia sesión con GitHub en cada dispositivo. Tu biblioteca de snippets se respalda en la nube y se mantiene sincronizada automáticamente — los cambios en un dispositivo aparecen en los demás.",
        },
        {
          q: "¿Mi código es privado?",
          a: "Tu biblioteca en la nube pertenece a tu cuenta autenticada y ningún otro usuario puede acceder a ella. Los snippets de invitado permanecen en el dispositivo donde los creaste, y todo el código es abierto para que puedas comprobar cómo funciona.",
        },
        {
          q: "¿Qué lenguajes de programación soporta?",
          a: "KlipCode resalta más de 25 lenguajes — JavaScript, TypeScript, Python, Go, Rust, SQL, HTML, CSS y más — además de un modo Markdown enriquecido para notas y documentación.",
        },
      ],
    },
    cta: {
      title: "¿Listo para organizar tu código?",
      subtitle:
        "Gratis, open source y listo en segundos. Empieza sin cuenta y lleva después tu biblioteca a cualquier lugar.",
      button: "Abrir KlipCode",
    },
    footer: {
      tagline: "Tus snippets de código, disponibles en cualquier lugar.",
      description:
        "KlipCode es un gestor de snippets gratuito y de código abierto. Empieza al instante e inicia sesión con GitHub para guardar y sincronizar tu biblioteca en todos tus dispositivos.",
      source: "Código fuente",
      product: "Producto",
      language: "Idioma",
      github: "GitHub",
    },
  },
  error: {
    title: "Algo ha salido mal",
    description: "Se ha producido un error inesperado. Puedes intentarlo de nuevo.",
    retry: "Reintentar",
  },
  notFound: {
    title: "Página no encontrada",
    description: "La página que buscas no existe o ha sido movida.",
    backHome: "Volver al inicio",
  },
  meta: {
    home: {
      title: "KlipCode — Gestor de Snippets de Código en la Nube",
      description:
        "Guarda, organiza y copia snippets con KlipCode, el gestor gratuito y open source. Empieza sin crear una cuenta y sincroniza tu biblioteca entre dispositivos.",
    },
    app: {
      title: "App de Snippets en la Nube",
      description:
        "Crea, organiza y copia snippets al instante. Inicia sesión con GitHub para guardar tu biblioteca de KlipCode y mantenerla sincronizada entre dispositivos.",
    },
  },
  seed: {
    folderName: "bienvenido",
    snippetName: "klipcode",
    snippetContent: WELCOME_SNIPPET_CONTENT,
  },
} as const satisfies Dictionary;
