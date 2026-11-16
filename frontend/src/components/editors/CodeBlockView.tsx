import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { Select } from '@/components/ui'
import { codeLanguageClass, codeLanguageOptions, codeLanguageValue, normalizeCodeLanguage } from '@/data/codeLanguage'
import './CodeBlockView.scss'

// A code block with its language menu (data/codeLanguage.ts). The menu sits in a bar
// above the code, in the block's own space, so opening it or choosing a language never
// moves the text. The language is the node's `language` attribute, so it is saved with
// the document and reaches everyone editing it live; the colors come from decorations
// (extensions/CodeBlockLanguage.ts), never from the document. In a document that can't
// be edited the menu is disabled and still shows the language.
export default function CodeBlockView({ node, editor, updateAttributes }: NodeViewProps) {
  const language = node.attrs.language as string | null
  return (
    <NodeViewWrapper className="code_block">
      <div className="code_block-bar" contentEditable={false}>
        <Select
          aria-label="Code language"
          className="code_block-language"
          value={codeLanguageValue(language)}
          disabled={!editor.isEditable}
          onChange={(e) => updateAttributes({ language: normalizeCodeLanguage(e.target.value) })}
        >
          {codeLanguageOptions(language).map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </Select>
      </div>
      <pre>
        <NodeViewContent as="code" className={codeLanguageClass(language) ?? undefined} />
      </pre>
    </NodeViewWrapper>
  )
}
