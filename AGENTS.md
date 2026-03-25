<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## KodeBoard | Project Specification & Instructions
Descripción: Aplicación web de gestión de fragmentos de código (snippets) multidispositivo. Enfoque en velocidad de entrada, minimalismo estético (estilo Vercel) y sincronización invisible.

### 1. Stack Tecnológico
Framework: Next.js (App Router).

Estilos: Tailwind CSS (Modo oscuro por defecto).

Editor: CodeMirror 6 (@uiw/react-codemirror).

Base de Datos: Supabase (PostgreSQL + Auth GitHub).

Persistencia Local: IndexedDB vía Dexie.js.

Sync/Estado: TanStack Query (React Query).

Despliegue: Dokploy.

Gestor de Paquetes: PNPM.

### 2. Reglas de Negocio y Flujo
Offline-First: Los datos se escriben primero en Dexie.js.

Auto-save: El editor no tiene botón de "Guardar". Usa un debounce (800ms) para sincronizar con Supabase.

Estados de Sync: Mostrar visualmente en el editor: Cambiando... (input local), Guardando... (petición en curso), Guardado en la nube (éxito).

Migración de sesión: Si hay datos en localStorage/IndexedDB al iniciar sesión con GitHub, se deben importar automáticamente al perfil del usuario en la nube.

Rendimiento: La Home muestra previsualizaciones de lectura (usar resaltado estático o CodeMirror en modo readOnly). Solo se instancia el editor completo al abrir el snippet.

### 3. Guía de Estilo (UI/UX)
Estética: Minimalista, profesional, tema oscuro por efecto. Inspiración en Vercel/Linear.

Fuentes: Cascadia Code (con ligaduras activas) para bloques de código.

Paleta: Fondo #0a0a0a, bordes #262626 (o white/10), acentos en blanco puro o gris suave.

Componentes: Menús y Selects totalmente personalizados (evitar nativos HTML).
