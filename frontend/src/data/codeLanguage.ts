// The languages a code block can be set to (docs/features/code_blocks.md). A code
// block stores its language as the `language` attribute of the `codeBlock` node, the
// one TipTap's CodeBlock already has, so the collaboration server's schema carries
// it with no change (collab-server/src/schema.ts). No language, or one that means
// "no language" (see PLAIN_NAMES), is plain text. Adding a language is one row here
// plus, for highlighting, a grammar in data/codeHighlight.ts.

export interface CodeLanguage {
  // The stored value, and the `language-<id>` class on the block's <code>.
  id: string
  label: string
  // Other names the same language goes by in fences and pasted code (```js, ```sh).
  aliases: string[]
}

export const CODE_LANGUAGES: CodeLanguage[] = [
  { id: 'javascript', label: 'JavaScript', aliases: ['js', 'jsx', 'mjs', 'cjs', 'node'] },
  { id: 'typescript', label: 'TypeScript', aliases: ['ts', 'tsx'] },
  { id: 'ruby', label: 'Ruby', aliases: ['rb'] },
  { id: 'python', label: 'Python', aliases: ['py'] },
  { id: 'swift', label: 'Swift', aliases: [] },
  { id: 'sql', label: 'SQL', aliases: [] },
  { id: 'json', label: 'JSON', aliases: [] },
  { id: 'yaml', label: 'YAML', aliases: ['yml'] },
  { id: 'html', label: 'HTML', aliases: ['htm', 'xml'] },
  { id: 'css', label: 'CSS', aliases: [] },
  { id: 'shell', label: 'Shell', aliases: ['sh', 'bash', 'zsh', 'console'] },
  { id: 'markdown', label: 'Markdown', aliases: ['md'] },
]

// What the menu shows for a block with no language, and the value of that choice.
export const PLAIN_TEXT_LABEL = 'Plain text'
export const PLAIN_TEXT_VALUE = ''

// Names that mean "no language", so a fence like ```text stays plain text.
const PLAIN_NAMES = ['plaintext', 'plain', 'text', 'txt']

export const CODE_LANGUAGE_CLASS_PREFIX = 'language-'

// The language a stored or pasted name means: its `id`, or null for plain text. A name
// that is not in the list (a Markdown import's ```rust) is kept as it is, so the menu
// can still show it and nothing is lost.
export function normalizeCodeLanguage(name: unknown): string | null {
  if (typeof name !== 'string') return null
  const lower = name.trim().toLowerCase()
  if (!lower || PLAIN_NAMES.includes(lower)) return null
  const known = CODE_LANGUAGES.find((language) => language.id === lower || language.aliases.includes(lower))
  return known ? known.id : lower
}

// The list entry for a name, or undefined when it is plain text or not in the list.
export function codeLanguageOf(name: unknown): CodeLanguage | undefined {
  const id = normalizeCodeLanguage(name)
  return CODE_LANGUAGES.find((language) => language.id === id)
}

// The `class` on a block's <code>: `language-<id>`, a stable hook for styles and for a
// highlighter. Null for plain text, which has none.
export function codeLanguageClass(name: unknown): string | null {
  const id = normalizeCodeLanguage(name)
  return id ? `${CODE_LANGUAGE_CLASS_PREFIX}${id}` : null
}

export interface CodeLanguageOption {
  value: string
  label: string
}

// The menu's options for a block whose stored language is `current`: plain text, a
// language that is not in the list but is stored on the block (shown by its own name),
// then the list.
export function codeLanguageOptions(current: unknown): CodeLanguageOption[] {
  const id = normalizeCodeLanguage(current)
  const unlisted = id && !CODE_LANGUAGES.some((language) => language.id === id) ? [{ value: id, label: id }] : []
  return [
    { value: PLAIN_TEXT_VALUE, label: PLAIN_TEXT_LABEL },
    ...unlisted,
    ...CODE_LANGUAGES.map(({ id: value, label }) => ({ value, label })),
  ]
}

// The menu's value for a stored language ('' for plain text). A menu choice is stored
// with normalizeCodeLanguage, which turns '' back into null.
export function codeLanguageValue(name: unknown): string {
  return normalizeCodeLanguage(name) ?? PLAIN_TEXT_VALUE
}
