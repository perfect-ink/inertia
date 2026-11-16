---
priority: p2
depends_on: [rebind-editor-shortcuts-to-apple-notes-map, paragraph-style-shortcuts]
components: [frontend, collab-server]
branch: backlog/code-blocks-with-language-and-syntax-highlighting
status: incomplete
---
# Code blocks with a language and syntax highlighting

## Objective

A code block in a document has a language, and its text is formatted (highlighted) for that language. The Monospace paragraph style and the code block are one thing, so there is one way to write code in a document.

## Requirements / notes

- **One thing, not two** (Alex, 2026-11-09): the Monospace paragraph style and the code block are the same. Choosing Monospace in the style picker makes a code block, and a code block shows as Monospace in the picker. They share one shortcut, `⌘⇧M` (the key Notes uses for Monospaced and the one `paragraph-style-shortcuts` gives Monospace); the temporary `⌘⌥⇧C` that `rebind-editor-shortcuts-to-apple-notes-map` used for the code block goes away.
- **Format by language** (Alex, 2026-11-09): a code block has a language, picked from a small menu on the block (plain text by default), and its text is highlighted for that language. Start with the common ones (JavaScript, TypeScript, Ruby, Python, Swift, SQL, JSON, YAML, HTML, CSS, shell, Markdown) and keep the list in a data file so adding one is a one-line change.
- The language is saved with the block, kept when the document is copied, exported or shared, and shown the same to everyone editing it live (the collab schema in `collab-server/src/schema.ts` carries the attribute; deploy the collab server with the frontend).
- Highlighting follows the theme in light and dark mode and meets contrast (AA, 4.5:1) in both.
- Existing Monospace paragraphs and code blocks keep their text; they open as code blocks in plain text.
- The language menu is a shared `@/components/ui` select, keyboard operable, touch-sized at 375px, and does not shift the block when it opens.

## Context

Asked for by Alex on 2026-11-09 while answering questions about `rebind-editor-shortcuts-to-apple-notes-map`. A highlighting library is a new dependency, which is Alex's call: build the first version with the small pure tokenizer or the highlighter the editor already ships if there is one, and record the choice.

## Acceptance criteria

- Monospace and code block are the same in the editor, the style picker and the shortcut sheet, on `⌘⇧M`.
- A code block's language is chosen from a menu, saved, and shown with highlighting in light and dark mode, live for other editors.
- Failed API calls show an error to the user.
- Tests cover the language list, the migration of existing Monospace text and the shortcut; a feature doc in `docs/features/` is written (or `paragraph_styles.md` and `editor_shortcuts.md` updated) and this file is removed.

## Blocked

**A real syntax highlighter is Alex's call (a new npm package).** The first version ships with a small tokenizer written for this task (`frontend/src/data/codeHighlight.ts`, one grammar per listed language, regular expressions, no package), as the Context above suggested. It is approximate: no JavaScript regex literals, no string interpolation or heredocs, no `<script>` or `<style>` contents in HTML, Markdown does not know it is inside a fence (the full list is in `docs/features/code_blocks.md`, Known limits). It never changes the text, only the colors.

If Alex wants highlight.js's coverage instead, the package is `lowlight` (it brings `highlight.js`; `@tiptap/extension-code-block-lowlight` is not needed because the editor draws its own decorations). It could not be added here because there is no network and `package-lock.json` cannot be regenerated offline. To add it, on a machine with network:

```sh
cd frontend && npm install lowlight
```

Then replace the body of `highlight(code, language)` in `frontend/src/data/codeHighlight.ts`, the only function the editor calls, with a call that returns `CodeToken[]` (`{ from, to, type }`) for the same code and language id: `createLowlight(common).highlight(id, code)` returns a tree whose text nodes carry `hljs-*` class names (map `hljs-keyword`, `hljs-string`, `hljs-number`, `hljs-comment`, `hljs-literal`, `hljs-title`/`hljs-built_in`/`hljs-tag`/`hljs-name`, `hljs-attr`/`hljs-attribute`/`hljs-variable` onto the seven `CodeTokenType`s) and offsets add up as you walk it. Delete the grammars and `codeHighlight.test.ts`'s grammar-specific cases, keep the range-validity and size-limit tests. Nothing else changes: the plugin, the colors in `CodeBlockView.scss` (already AA-checked theme tokens), the language menu and the `language-<id>` class all read the same token types. `lowlight` 3 is ESM only, so Jest will also need `transformIgnorePatterns` to let it through (`frontend/jest.config.js`).

## Unverified

Built and checked here without `node_modules`, a database or a browser:
- Ran: the offline runner (`JEST_STUB_NET=1 /tmp/runner/all.sh`): static parse of the changed files; the pure tests `codeLanguage`, `codeHighlight`, `codeBlock`, `paragraphStyle`, `paragraphStyleShortcut`, `editorShortcut` (including that `docs/keyboard-shortcuts.md` and the Mac Format menu list the row), `util/paragraphStyleCommand`; the component tests `ParagraphStylePicker` and, through a temporary virtual `@tiptap/react` mock, `CodeBlockView` (menu, saved language, alias, unlisted language, disabled, token colors are only AA-checked theme tokens); and a check that the collaboration server's `monospaceToCodeBlocks` copy gives the same result as the frontend's on sample documents.
- Not run: the real Jest suite, in particular `frontend/src/extensions/CodeBlockLanguage.test.ts` (written against a real TipTap schema: attribute, written and parsed HTML, decorations) and `CodeBlockView.test.tsx`; the collaboration server's Vitest (`collab-server/test/codeBlock.test.ts`, `schema.test.ts`); ESLint, Stylelint, `tsc -b`; the Swift build (one label string in `FormatMenu.swift` changed); a browser.

To verify, on a machine with the dependencies:

```sh
cd frontend && npm install && npm run lint && npx tsc -b && npm test
cd ../collab-server && npm install && npm run lint && npx tsc -p tsconfig.json --noEmit && npm test
make test-fast && make build-mac
```

Then in a browser, in light and dark and at 375px and desktop width, with the collaboration server running:
- A new code block (`⌘⇧M`, the toolbar button, or typing three backticks and `js`) shows the language menu in a bar above the code; opening it and choosing JavaScript, then Plain text, never moves the code; the menu is keyboard operable and touch-sized at 375px.
- The Style menu shows Monospace for a code block and `⌘⇧M` beside Monospace; choosing Monospace on a paragraph makes a code block, choosing Body turns it back with the text kept.
- Colors are readable in both themes for each listed language.
- With two browsers on one document, a language chosen in one shows in the other.
- A document with an old Monospace paragraph (set `style` to `monospace` on a top-level paragraph in `documents.content`) opens with a code block in plain text, and its text is saved as a code block after an edit.
- Deploy the collaboration server together with the frontend (`collab-server/src/persistence.ts` changed; the schema did not).
