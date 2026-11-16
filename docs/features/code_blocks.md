# Code blocks

## What it does
Monospace and the code block are one thing (Alex, 2026-11-09), so there is one way to write code in a document.

- **One thing.** Choosing **Monospace** in the toolbar's Style menu makes a code block; a code block shows as Monospace in that menu; choosing another style turns it back into a paragraph or heading with its text kept. `⌘⇧M` (`Ctrl+Shift+M`, Apple Notes' Monospaced key) toggles a code block and is the one key for both: the Style menu shows it beside Monospace, and the `⌘/` sheet, the Mac Format menu and `docs/keyboard-shortcuts.md` list one row, "Code block (Monospace)". The toolbar's code block button is the same command. The temporary `⌘⌥⇧C` is gone.
- **A language per block.** Each block has a language menu in a bar above its code (a shared `Select`, so it is the same in every browser, keyboard operable and touch-sized on a phone). It starts as **Plain text**. The list is JavaScript, TypeScript, Ruby, Python, Swift, SQL, JSON, YAML, HTML, CSS, Shell and Markdown, in `frontend/src/data/codeLanguage.ts`; adding a language is one row there, plus a grammar in `data/codeHighlight.ts` for colors. The bar is part of the block, so opening the menu or choosing a language never moves the code. In a document that can't be edited the menu is disabled and still shows the language.
- **Syntax colors.** The text is colored for its language: comments, strings, numbers, keywords, literals (`true`, `nil`), names (functions, types, tags) and attributes (JSON keys, CSS properties, variables). The colors are drawn as editor decorations, never stored: the document holds only the text and the `language`, so collaborators, copies, exports and the collaboration server see plain text with a language. Colors follow the theme in light and dark: they are the status text tokens (`--status-<hue>-text`), already checked at 4.5:1 (WCAG AA) on the page, a card and the muted surface a block sits on, in both themes (`docs/features/status_colors.md`; `CodeBlockView.test.tsx` fails if a token color is anything else). A block over 20,000 characters is left uncolored so one huge paste can't slow typing.
- **Shared with everyone.** The language is the `language` attribute of the `codeBlock` node, the one TipTap's CodeBlock already has, so it is saved with the document, changes live for everyone editing, and survives copy and paste. Written HTML has `<pre><code class="language-<id>">`, a stable hook for styles or a highlighter; the id is the list's, even when the stored name was an alias (typing ```` ```js ```` or a Markdown import's `js` shows JavaScript and writes `language-javascript`). A language the list lacks (a Markdown import's `rust`) is kept, shown in the menu under its own name, and left uncolored. Markdown export writes the fence with the stored language.
- **Existing Monospace text.** A document written before this holds Monospace as a paragraph whose `style` is `monospace`. When the document is first loaded those paragraphs become code blocks, their text kept (marks dropped, line breaks as newlines, a link to a document dropped since a code block holds text only), language none. The collaboration server does it when it seeds a room from Rails' content (`collab-server/src/codeBlock.ts`); the editor does it for a document opened without the collaboration server (`data/codeBlock.ts`, called in `DocumentScreen.tsx`). Nothing is rewritten at rest until the document is next saved. Each Monospace paragraph becomes its own block; consecutive ones are not merged. Existing code blocks keep their text and open in plain text.

## API and models
None. No endpoint, model or migration; the language lives in the document's content JSON.

Code:
- `frontend/src/data/codeLanguage.ts`: the list, aliases, `normalizeCodeLanguage`, `codeLanguageClass`, the menu's options.
- `frontend/src/data/codeHighlight.ts`: the tokenizer, one grammar per language, and `highlight(code, language)`, the **single function that finds the colored ranges**. Everything else (the plugin, the styles) only reads its `{from, to, type}` result.
- `frontend/src/extensions/CodeBlockLanguage.ts`: TipTap's CodeBlock plus the node view, the `language-<id>` class in written HTML and the decoration plugin (`codeBlockDecorations`).
- `frontend/src/components/editors/CodeBlockView.tsx` and `.scss`: the block, its language menu and the token colors.
- `frontend/src/data/codeBlock.ts` and `collab-server/src/codeBlock.ts`: `monospaceToCodeBlocks`, a copy in each package (KEEP IN SYNC; the two packages share no code, as with `schema.ts`).
- `frontend/src/data/paragraphStyle.ts` (`codeBlock` flag, `styleOfBlock`), `util/paragraphStyleCommand.ts` (Monospace calls `setCodeBlock`), `data/paragraphStyleShortcut.ts` (`keysOfStyle`), `data/editorShortcut.ts` (the row's label).

The collaboration server's schema needs no change (`collab-server/src/schema.ts`, whose comment says so), but `collab-server/src/persistence.ts` now converts old Monospace paragraphs on load, so **deploy the collaboration server with the frontend**. Until it is, old Monospace paragraphs stay paragraphs: they still look monospace and show as Monospace in the menu, they are just not converted.

## Who can view and change
Anyone who can view a document sees the language and colors; anyone who can edit it can make code blocks and change a block's language. No permission changes.

## Tests
- `frontend/src/data/codeLanguage.test.ts`: the language list, aliases, plain text, the `language-<id>` class, the menu's options.
- `frontend/src/data/codeHighlight.test.ts`: every listed language has a grammar, each grammar's tokens, ranges in order and in bounds, the size limit, and that hostile input finishes fast.
- `frontend/src/data/codeBlock.test.ts` and `collab-server/test/codeBlock.test.ts` (with `onLoadDocument` seeding a room): existing Monospace text becoming code blocks.
- `frontend/src/data/paragraphStyle.test.ts`, `paragraphStyleShortcut.test.ts`, `editorShortcut.test.ts`, `util/paragraphStyleCommand.test.ts`, `components/ParagraphStylePicker.test.tsx`: Monospace is the code block, one `⌘⇧M` row, the menu shows the key and calls `setCodeBlock`.
- `frontend/src/components/editors/CodeBlockView.test.tsx`: the menu, saving a language, an alias, an unlisted language, disabled when not editable, and that token colors are only the AA-checked theme tokens.
- `frontend/src/extensions/CodeBlockLanguage.test.ts` (a real TipTap schema): the attribute, written HTML and read-back, decorations. `extensions/EditorShortcuts.test.ts` still covers `⌘⇧M` on a real editor.
- `collab-server/test/schema.test.ts`: the language is kept and defaults to plain text.

## Known limits
- **The highlighter is a small tokenizer, not a highlighting library.** None is installed and a new package needs Alex's call (and a lockfile change); the task file's Blocked section has the package and the command. The tokenizer works line by line with regular expressions, so it is approximate: no regex literals in JavaScript, no string interpolation or heredocs, HTML does not color the contents of `<script>` or `<style>`, Markdown does not know it is inside a fence, a CSS `#add-item` can read as a hex color, and nothing tells types from names beyond a capital letter. It never changes the text; the worst case is a wrong color.
- A Monospace paragraph inside a list item or a checklist line stays a paragraph (its first child has to be one) and keeps its monospace look; so does a custom style built on Monospace. Pasting HTML from another document with a Monospace paragraph keeps it as a paragraph too.
- Consecutive Monospace paragraphs become separate blocks, not one.
- The language menu is always visible on a block (it is how the language is found and changed); there is no per-block option to hide it.
- This task added no key to the block beyond `⌘⇧M`'s new label (no indent key, for example); the block's own TipTap keys (Enter, Backspace, arrows) are as they were.
- Not checked by hand: the real Jest suite, `tsc -b`, lint, a browser at desktop and 375px in light and dark, the language menu inside the collaborative editor, two browsers editing one block's language, and the Mac app.

## History
- Implemented 2026-11-16 on branch `backlog/code-blocks-with-language-and-syntax-highlighting`. Not merged or deployed. Verified here (no `node_modules`, database or browser): the pure tests and the component tests that don't need TipTap in the offline Jest stand-in, a static parse of the changed files, and the collaboration server's copy against the frontend's on sample documents. Not run: the real Jest suite (including `CodeBlockLanguage.test.ts`, which needs TipTap), the collaboration server's Vitest, ESLint, Stylelint, `tsc -b` and a browser.
- Not implemented: a highlighting library (Blocked, see the task file).
