# KlipCode

KlipCode es un gestor de snippets de código con enfoque offline-first. Permite guardar, organizar y copiar fragmentos rápidamente, trabajar con carpetas jerárquicas, fijar elementos importantes y sincronizar todo con la nube cuando conectas tu cuenta de GitHub mediante Supabase.

## Características

- Guardado local inmediato en IndexedDB.
- Sincronización con la nube cuando Supabase está configurado.
- Organización por carpetas con varios niveles de profundidad.
- Arrastrar y soltar para mover carpetas y snippets.
- Copia rápida al portapapeles.
- Editor con guardado automático.
- Snippets fijados en inicio y en la barra lateral.
- Interfaz y textos en español.

## Tecnologías

- Next.js 16 con App Router.
- React 19.
- Tailwind CSS v4.
- CodeMirror 6.
- Dexie.js para persistencia local.
- Supabase para autenticación y sincronización.
- TanStack Query para el estado remoto.

## Requisitos

- Node.js 20 o superior.
- pnpm.
- Opcional: cuenta de Supabase para activar la sincronización en la nube.

## Instalación

1. Instala dependencias:

```bash
pnpm install
```

2. Inicia el entorno de desarrollo:

```bash
pnpm dev
```

3. Abre [http://localhost:3000](http://localhost:3000).

## Variables de entorno

Para usar Supabase y la sincronización entre dispositivos, define estas variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=
```

Opcionalmente, puedes definir la URL pública del sitio:

```bash
NEXT_PUBLIC_SITE_URL=
```

Si no configuras Supabase, la aplicación sigue funcionando en modo local con IndexedDB.

## Scripts

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm test
pnpm test:watch
```

## Base de datos

El esquema de Supabase está en [db-structure.sql](db-structure.sql). Incluye las tablas de perfiles, carpetas y snippets, además de las políticas RLS necesarias para trabajar con datos propios de cada usuario.

## Estructura general

- [src/app](src/app) contiene la entrada principal de Next.js.
- [src/components](src/components) agrupa la UI de la aplicación.
- [src/hooks](src/hooks) contiene la lógica de mutaciones, auth y sincronización.
- [src/lib](src/lib) reúne acceso a datos, tipos y utilidades.
- [src/i18n](src/i18n) centraliza los textos visibles de la interfaz.

## Uso rápido

1. Crea un snippet desde la pantalla principal o desde la barra lateral.
2. Organízalo en una carpeta o muévelo con drag and drop.
3. Edita el código y deja que el guardado automático sincronice los cambios.
4. Inicia sesión con GitHub para llevar tus snippets a la nube.

## Despliegue

La aplicación puede desplegarse como cualquier proyecto de Next.js. Si vas a publicarla, asegúrate de configurar `NEXT_PUBLIC_SITE_URL` y las variables de Supabase en el entorno de producción.
