import type { Editor } from '@tiptap/core'
import { styleById, type ParagraphStyleId } from '@/data/paragraphStyle'
import { PARAGRAPH_STYLE_SHORTCUTS, type ParagraphStyleShortcut } from '@/data/paragraphStyleShortcut'
import { NO_CUSTOM_COPY } from '@/data/customParagraphStyle'

type StyleEditor = Pick<Editor, 'chain'>

// Gives the block at the cursor a paragraph style: a heading level, a code block
// (Monospace is the code block), or a paragraph with the style's name. False when the
// block can't take it (the document's first block has to stay a heading), in which
// case nothing changes. Leaving a code block for another style turns it back into a
// paragraph or heading, its text kept.
export function applyParagraphStyle(editor: StyleEditor, id: ParagraphStyleId): boolean {
  const style = styleById(id)
  const chain = editor.chain().focus()
  if (style.heading) return chain.setHeading({ level: style.heading }).run()
  if (style.codeBlock) return chain.setCodeBlock().run()
  return chain.setParagraph().updateAttributes('paragraph', { style: style.paragraphStyle, ...NO_CUSTOM_COPY }).run()
}

// The TipTap keymap for the styles that ParagraphStyleShortcuts binds; the
// headings keep TipTap's own ⌘⌥1 to ⌘⌥3.
export function paragraphStyleKeymap(editor: StyleEditor, shortcuts: ParagraphStyleShortcut[] = PARAGRAPH_STYLE_SHORTCUTS): Record<string, () => boolean> {
  return Object.fromEntries(
    shortcuts
      .filter((s) => s.boundBy === 'styles')
      .map((s) => [s.tiptap, () => applyParagraphStyle(editor, s.style)]),
  )
}
