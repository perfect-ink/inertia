import { generateHTML, generateJSON, getSchema } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { CodeBlockLanguage, codeBlockDecorations } from './CodeBlockLanguage'

// The node view is tested on its own (components/editors/CodeBlockView.test.tsx) and needs
// the page to mount, so a bare node here keeps these tests to the schema, HTML and colors.
jest.mock('@/components/editors/CodeBlockView', () => function CodeBlockViewMock() { return null })

const extensions = [Document, Paragraph, Text, CodeBlockLanguage]
const schema = getSchema(extensions)

const code = (language: string | null, text: string) => ({
  type: 'doc',
  content: [{ type: 'codeBlock', attrs: { language }, content: [{ type: 'text', text }] }],
})

// The colored text and its class, for a document with one code block.
function colored(language: string | null, text: string) {
  const doc = schema.nodeFromJSON(code(language, text))
  return codeBlockDecorations(doc).find().map((d) => [
    doc.textBetween(d.from, d.to),
    (d as unknown as { type: { attrs: { class: string } } }).type.attrs.class,
  ])
}

test('the block keeps TipTap\'s own language attribute, null for plain text', () => {
  expect(schema.nodes.codeBlock.spec.attrs).toHaveProperty('language')
  expect(schema.nodeFromJSON(code('ruby', 'x').content[0]).attrs.language).toBe('ruby')
  expect(schema.nodeFromJSON(code(null, 'x').content[0]).attrs.language).toBeNull()
})

test('writes language-<id> on the <code>, the language\'s id even for an alias, and no class for plain text', () => {
  expect(generateHTML(code('javascript', 'a'), extensions)).toBe('<pre><code class="language-javascript">a</code></pre>')
  expect(generateHTML(code('js', 'a'), extensions)).toBe('<pre><code class="language-javascript">a</code></pre>')
  expect(generateHTML(code('rust', 'a'), extensions)).toBe('<pre><code class="language-rust">a</code></pre>')
  expect(generateHTML(code(null, 'a'), extensions)).toBe('<pre><code>a</code></pre>')
})

test('the language survives copy and paste: HTML read back gives the same language', () => {
  const html = generateHTML(code('python', 'print(1)'), extensions)
  const back = generateJSON(html, extensions)
  expect(back.content[0].attrs.language).toBe('python')
  expect(back.content[0].content[0].text).toBe('print(1)')
})

test('colors a block\'s tokens as decorations over its text', () => {
  expect(colored('ruby', 'def x # hi')).toEqual([
    ['def', 'code_token code_token--keyword'],
    ['# hi', 'code_token code_token--comment'],
  ])
})

test('colors nothing in plain text, and nothing for a language it has no grammar for', () => {
  expect(colored(null, 'def x')).toEqual([])
  expect(colored('rust', 'fn main() {}')).toEqual([])
})

test('colors every code block in a document, and only those', () => {
  const doc = schema.nodeFromJSON({
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'def not code' }] },
      code('ruby', 'end').content[0],
      code('json', '{"a": 1}').content[0],
    ],
  })
  const texts = codeBlockDecorations(doc).find().map((d) => doc.textBetween(d.from, d.to))
  expect(texts).toEqual(['end', '"a"', '1'])
})
