// The paragraph styles every document offers. A style is either a heading level
// or a named look stored on a paragraph (its `style` attribute); "body" is the
// plain paragraph. Mirrored in collab-server/src/schema.ts (the paragraph attribute).
// Monospace is the exception: it is the code block (Alex, 2026-11-09), so choosing it
// makes a code block, and a code block shows as Monospace. A paragraph whose style is
// still "monospace" (a document older than that, or pasted) also reads as Monospace
// until it is turned into a code block (data/codeBlock.ts).
export type ParagraphStyleId = 'title' | 'subtitle' | 'heading1' | 'heading2' | 'heading3' | 'body' | 'quote' | 'caption' | 'monospace'

export interface ParagraphStyle {
  id: ParagraphStyleId
  label: string
  // Headings are heading nodes of this level; everything else is a paragraph with this style value.
  heading?: 1 | 2 | 3
  paragraphStyle?: 'title' | 'subtitle' | 'body' | 'quote' | 'caption' | 'monospace'
  // Applying the style makes a code block rather than setting a paragraph's style.
  codeBlock?: true
}

export const PARAGRAPH_STYLES: ParagraphStyle[] = [
  { id: 'title', label: 'Title', paragraphStyle: 'title' },
  { id: 'subtitle', label: 'Subtitle', paragraphStyle: 'subtitle' },
  { id: 'heading1', label: 'Heading 1', heading: 1 },
  { id: 'heading2', label: 'Heading 2', heading: 2 },
  { id: 'heading3', label: 'Heading 3', heading: 3 },
  { id: 'body', label: 'Body', paragraphStyle: 'body' },
  { id: 'quote', label: 'Quote', paragraphStyle: 'quote' },
  { id: 'caption', label: 'Caption', paragraphStyle: 'caption' },
  { id: 'monospace', label: 'Monospace', paragraphStyle: 'monospace', codeBlock: true },
]

// The style a block currently has, or null for blocks that aren't styled
// paragraphs, headings 1 to 3 or code blocks (lists, deeper headings...).
export function styleOfBlock(typeName: string, attrs: { level?: number; style?: string | null }): ParagraphStyleId | null {
  if (typeName === 'heading') {
    const match = PARAGRAPH_STYLES.find((s) => s.heading === attrs.level)
    return match ? match.id : null
  }
  if (typeName === 'codeBlock') return 'monospace'
  if (typeName === 'paragraph') {
    return PARAGRAPH_STYLES.find((s) => s.paragraphStyle === (attrs.style ?? 'body'))?.id ?? 'body'
  }
  return null
}

export function styleById(id: ParagraphStyleId): ParagraphStyle {
  return PARAGRAPH_STYLES.find((s) => s.id === id) as ParagraphStyle
}
