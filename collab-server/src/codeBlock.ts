// Monospace paragraphs and code blocks are one thing (Alex, 2026-11-09). A document
// saved before that holds Monospace as a paragraph whose `style` is "monospace";
// seeding a room from Rails' content turns those into code blocks (text kept, no
// language), so they open as code blocks for everyone and are saved as such.
//
// KEEP IN SYNC with frontend/src/data/codeBlock.ts (a copy: the two packages share no
// code, like schema.ts and the editor's extensions). Its tests describe the rules.

export interface DocNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  text?: string;
  [key: string]: unknown;
}

// Where a code block may stand: the document and a table's cells. A list item's or a
// checklist line's first child has to be a paragraph, so one there stays a paragraph.
const HOLDS_ANY_BLOCK = new Set(["doc", "table", "tableRow", "tableCell", "tableHeader"]);

// A paragraph's text, a line break as a newline; anything else inline is dropped,
// since a code block holds text only.
export function plainTextOf(node: DocNode): string {
  return (node.content ?? []).map((child) => {
    if (child.type === "text") return child.text ?? "";
    if (child.type === "hardBreak") return "\n";
    return "";
  }).join("");
}

export function isMonospaceParagraph(node: DocNode): boolean {
  return node.type === "paragraph" && node.attrs?.style === "monospace";
}

function convert(node: DocNode): DocNode {
  if (isMonospaceParagraph(node)) {
    const text = plainTextOf(node);
    return text ? { type: "codeBlock", content: [{ type: "text", text }] } : { type: "codeBlock" };
  }
  const children = node.content;
  if (!node.type || !HOLDS_ANY_BLOCK.has(node.type) || !children) return node;
  const content = children.map(convert);
  return content.some((child, i) => child !== children[i]) ? { ...node, content } : node;
}

// The document with its Monospace paragraphs as code blocks; the same object when there
// is none. Anything that is not a document is returned as it is.
export function monospaceToCodeBlocks<T>(doc: T): T {
  if (!doc || typeof doc !== "object" || (doc as DocNode).type !== "doc") return doc;
  return convert(doc as DocNode) as T;
}
