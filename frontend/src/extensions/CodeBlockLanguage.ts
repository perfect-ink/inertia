import { mergeAttributes } from '@tiptap/core'
import CodeBlock from '@tiptap/extension-code-block'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { ReactNodeViewRenderer } from '@tiptap/react'
import CodeBlockView from '@/components/editors/CodeBlockView'
import { highlight, tokenClass, type CodeToken } from '@/data/codeHighlight'
import { codeLanguageClass } from '@/data/codeLanguage'

// The colored ranges of each code block, kept for as long as the block's node lasts
// (ProseMirror reuses a node that did not change), so typing in one block does not
// colour the others again.
const tokensByNode = new WeakMap<ProseMirrorNode, CodeToken[]>()

function tokensOf(node: ProseMirrorNode): CodeToken[] {
  let tokens = tokensByNode.get(node)
  if (!tokens) {
    tokens = highlight(node.textContent, node.attrs.language)
    tokensByNode.set(node, tokens)
  }
  return tokens
}

// Decorations that color the code in every code block of `doc`. They are drawn over
// the text and are not part of the document, so they are never saved, synced, copied
// or exported. A code block holds text only, so a token's offset in the text is its
// offset in the node.
export function codeBlockDecorations(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'codeBlock') return true
    for (const token of tokensOf(node)) {
      decorations.push(Decoration.inline(pos + 1 + token.from, pos + 1 + token.to, { class: tokenClass(token.type) }))
    }
    return false
  })
  return DecorationSet.create(doc, decorations)
}

const highlightKey = new PluginKey<DecorationSet>('codeBlockHighlight')

// The editor's code block: TipTap's CodeBlock with a language menu on the block
// (components/editors/CodeBlockView.tsx) and syntax colors (data/codeHighlight.ts).
// The `language` attribute is TipTap's own, and the collaboration server's schema uses
// the same extension, so it needs no copy there (collab-server/src/schema.ts). HTML
// written for a block (copy, getHTML) carries `language-<id>` on its <code>, with the
// language's id even when the stored name was an alias (```js is language-javascript).
export const CodeBlockLanguage = CodeBlock.extend({
  addNodeView() {
    // Clicks and keys in the language bar belong to its menu: without this the editor
    // would take a click on the bar as a click on the block and select it.
    return ReactNodeViewRenderer(CodeBlockView, {
      stopEvent: ({ event }) => (event.target as Element | null)?.closest?.('.code_block-bar') != null,
    })
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['pre', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), ['code', { class: codeLanguageClass(node.attrs.language) }, 0]]
  },

  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() ?? []),
      new Plugin({
        key: highlightKey,
        state: {
          init: (_config, { doc }) => codeBlockDecorations(doc),
          apply: (tr, decorations) => (tr.docChanged ? codeBlockDecorations(tr.doc) : decorations),
        },
        props: {
          decorations: (state) => highlightKey.getState(state),
        },
      }),
    ]
  },
})
