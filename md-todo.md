# Markdown editor — TODO

Mejoras pendientes para dejar el editor de Markdown (WYSIWYG TipTap, `src/components/MarkdownPreview/`) al nivel "100% profesional". Lo que ya está hecho queda fuera de esta lista.

## ✅ Hecho
- Slash menu (`/`) para insertar bloques (`SlashCommand.ts` / `SlashCommandList.tsx`).
- BubbleMenu ampliado (H3, lista ordenada, task list, code block) + labels i18n.
- Tablas: inserción desde el slash menu + controles flotantes (añadir/eliminar fila/columna, eliminar tabla) en `TableMenu`.
- Selector de lenguaje en bloques de código reutilizando `LanguageSelect` (`CodeBlockComponent.tsx`).
- Preservar scroll/cursor al alternar source ⇄ preview: ambos editores quedan montados tras la primera visita (ocultos con `visibility`), y el WYSIWYG re-sincroniza el documento solo si el source cambió (`SnippetEditor.tsx`, `MarkdownEditorInner.tsx`).
- Paste inteligente de enlaces: pegar una URL sobre texto seleccionado crea el link directamente (`SmartLinkPaste.ts`).
- Botón de copiar al hover en los bloques de código, también en modo solo-lectura (`CodeBlockComponent.tsx`).

## Pendiente

### Alto impacto
- [ ] **Imágenes.** No hay `@tiptap/extension-image`. Decisión de arquitectura por el almacenamiento cliente/sync: base64 inline (simple pero infla IndexedDB y el payload de sync), URL externa, o subir a un almacenamiento de objetos. Soportar pegar/arrastrar + insertar por URL.

### Medio impacto
- [ ] **Drag handles** para reordenar bloques (`@tiptap/extension-drag-handle`), muy Notion.
- [ ] **Contador de palabras/caracteres** y, para documentos largos, **outline/TOC** navegable.
- [ ] **Highlight (`==texto==`)** y sub/superíndice. Ojo: las marcas de TipTap no traen serialización Markdown por defecto; hay que configurar `toMarkdown`/`parseMarkdown` en `tiptap-markdown` para que hagan round-trip (si no, se pierden con `html: false`).
- [ ] **Find & replace** dentro del WYSIWYG (en el modo source ya existe vía CodeMirror).

### Detalles técnicos
- [ ] **`html: false` en `tiptap-markdown`** (`MarkdownEditorInner.tsx`): el HTML embebido en el `.md` se descarta en silencio (p. ej. `<details>`, `<br>`). Decidir si es intencional y, si lo es, avisar al usuario.
- [ ] **Accesibilidad de los menús flotantes:** tippy.js no gestiona el foco por teclado; las toolbars flotantes (BubbleMenu / TableMenu) no son navegables con teclado más allá del item activo.
