// The collaboration server's copy of frontend/src/data/codeBlock.ts: Monospace
// paragraphs from before they were the code block open as code blocks.
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { yDocToProsemirrorJSON } from "y-prosemirror";
import { isMonospaceParagraph, monospaceToCodeBlocks, plainTextOf, type DocNode } from "../src/codeBlock.js";
import { onLoadDocument } from "../src/persistence.js";

const text = (value: string, marks?: unknown[]): DocNode => ({ type: "text", text: value, ...(marks ? { marks } : {}) });
const mono = (...content: DocNode[]): DocNode => ({ type: "paragraph", attrs: { style: "monospace" }, content });
const heading: DocNode = { type: "heading", attrs: { level: 1 }, content: [text("Title")] };
const doc = (...content: DocNode[]): DocNode => ({ type: "doc", content: [heading, ...content] });

describe("monospaceToCodeBlocks", () => {
  it("turns a Monospace paragraph into a code block with its text and no language", () => {
    const converted = monospaceToCodeBlocks(doc(mono(text("npm test"))));
    expect(converted.content).toEqual([heading, { type: "codeBlock", content: [{ type: "text", text: "npm test" }] }]);
  });

  it("keeps the text whole: marks dropped, line breaks as newlines, other inline nodes dropped", () => {
    const paragraph = mono(text("a = "), text("1", [{ type: "bold" }]), { type: "hardBreak" }, text("b"), { type: "documentLink", attrs: { documentId: 3 } });
    expect(plainTextOf(paragraph)).toBe("a = 1\nb");
    expect((monospaceToCodeBlocks(doc(paragraph)).content as DocNode[])[1]).toEqual({ type: "codeBlock", content: [{ type: "text", text: "a = 1\nb" }] });
  });

  it("makes an empty Monospace paragraph an empty code block", () => {
    expect((monospaceToCodeBlocks(doc({ type: "paragraph", attrs: { style: "monospace" } })).content as DocNode[])[1]).toEqual({ type: "codeBlock" });
  });

  it("leaves other blocks, existing code blocks and custom styles as they are", () => {
    const body: DocNode = { type: "paragraph", content: [text("prose")] };
    const custom: DocNode = { type: "paragraph", attrs: { style: "custom-3", styleName: "Mine", styleProps: '{"base":"monospace"}' }, content: [text("x")] };
    const existing: DocNode = { type: "codeBlock", attrs: { language: "ruby" }, content: [text("puts 1")] };
    const input = doc(body, custom, existing);
    expect(monospaceToCodeBlocks(input)).toBe(input);
  });

  it("reaches a table's cells but not a list item or a checklist line", () => {
    const cell = (child: DocNode): DocNode => ({ type: "tableCell", content: [child] });
    const table: DocNode = { type: "table", content: [{ type: "tableRow", content: [cell(mono(text("in a cell")))] }] };
    const list: DocNode = { type: "bulletList", content: [{ type: "listItem", content: [mono(text("in a list"))] }] };
    const tasks: DocNode = { type: "workspaceTaskList", content: [{ type: "workspaceTaskItem", content: [mono(text("in a task"))] }] };
    const converted = monospaceToCodeBlocks(doc(table, list, tasks)).content as DocNode[];
    const firstCell = ((converted[1].content as DocNode[])[0].content as DocNode[])[0];
    expect((firstCell.content as DocNode[])[0].type).toBe("codeBlock");
    expect(converted[2]).toBe(list);
    expect(converted[3]).toBe(tasks);
  });

  it("returns what is not a document as it is, and never changes its input", () => {
    expect(monospaceToCodeBlocks(null)).toBeNull();
    const withMono = doc(mono(text("x")));
    const before = JSON.stringify(withMono);
    monospaceToCodeBlocks(withMono);
    expect(JSON.stringify(withMono)).toBe(before);
    expect(isMonospaceParagraph(mono())).toBe(true);
    expect(isMonospaceParagraph({ type: "paragraph", attrs: { style: "body" } })).toBe(false);
  });
});

describe("onLoadDocument", () => {
  it("seeds a room from Rails' content with its Monospace paragraphs as code blocks", async () => {
    const document = new Y.Doc();
    const content = doc(mono(text("npm test")), { type: "paragraph", content: [text("prose")] });
    await onLoadDocument({ document, context: { initialContent: content } } as unknown as Parameters<typeof onLoadDocument>[0]);
    const seeded = yDocToProsemirrorJSON(document, "default") as { content: { type: string; content?: { text: string }[] }[] };
    expect(seeded.content.map((node) => node.type)).toEqual(["heading", "codeBlock", "paragraph"]);
    expect(seeded.content[1].content?.[0].text).toBe("npm test");
  });
});
