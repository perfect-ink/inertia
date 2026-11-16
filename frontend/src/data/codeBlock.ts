// Monospace paragraphs and code blocks are one thing (Alex, 2026-11-09): a document
// written before that holds Monospace as a paragraph whose `style` is "monospace".
// `monospaceToCodeBlocks` turns those into code blocks, text kept, language none (plain
// text). It runs on a document's JSON when it is first loaded into an editor: the
// collaboration server does it when it seeds a room from Rails' content
// (collab-server/src/codeBlock.ts, a copy of this: KEEP IN SYNC), and the editor does it
// for a document opened without the collaboration server. Nothing is rewritten at rest
// until the document is next saved, and then as code blocks.

export interface DocNode {
  type?: string
  attrs?: Record<string, unknown>
  content?: DocNode[]
  text?: string
  [key: string]: unknown
}

// Where a code block may stand: the document, and a table's cells. A list item's or a
// checklist line's first child has to be a paragraph, so a Monospace paragraph there
// stays a paragraph (and keeps its look).
const HOLDS_ANY_BLOCK = new Set(['doc', 'table', 'tableRow', 'tableCell', 'tableHeader'])

// The plain text of a paragraph: its text, a line break as a newline, anything else
// (a link to a document, say) dropped, since a code block holds text only.
export function plainTextOf(node: DocNode): string {
  return (node.content ?? []).map((child) => {
    if (child.type === 'text') return child.text ?? ''
    if (child.type === 'hardBreak') return '\n'
    return ''
  }).join('')
}

export function isMonospaceParagraph(node: DocNode): boolean {
  return node.type === 'paragraph' && node.attrs?.style === 'monospace'
}

function convert(node: DocNode): DocNode {
  if (isMonospaceParagraph(node)) {
    const text = plainTextOf(node)
    return text ? { type: 'codeBlock', content: [{ type: 'text', text }] } : { type: 'codeBlock' }
  }
  if (!node.type || !HOLDS_ANY_BLOCK.has(node.type) || !node.content) return node
  const content = node.content.map(convert)
  return content.some((child, i) => child !== node.content![i]) ? { ...node, content } : node
}

// The document with its Monospace paragraphs as code blocks. The same object comes back
// when there is none, so a caller can tell nothing changed. Not given a document (null,
// something that is not one) it returns the input.
export function monospaceToCodeBlocks<T>(doc: T): T {
  if (!doc || typeof doc !== 'object' || (doc as DocNode).type !== 'doc') return doc
  return convert(doc as DocNode) as T
}
