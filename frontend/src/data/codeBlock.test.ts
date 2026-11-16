import { isMonospaceParagraph, monospaceToCodeBlocks, plainTextOf, type DocNode } from './codeBlock'

const text = (value: string, marks?: unknown[]): DocNode => ({ type: 'text', text: value, ...(marks ? { marks } : {}) })
const mono = (...content: DocNode[]): DocNode => ({ type: 'paragraph', attrs: { style: 'monospace' }, content })
const heading: DocNode = { type: 'heading', attrs: { level: 1 }, content: [text('Title')] }
const doc = (...content: DocNode[]): DocNode => ({ type: 'doc', content: [heading, ...content] })

test('a Monospace paragraph at the top of a document becomes a code block with its text and no language', () => {
  const converted = monospaceToCodeBlocks(doc(mono(text('npm test'))))
  expect(converted.content).toEqual([heading, { type: 'codeBlock', content: [{ type: 'text', text: 'npm test' }] }])
  expect((converted.content as DocNode[])[1].attrs).toBeUndefined()
})

test('its text is kept whole, marks dropped, line breaks as newlines, other inline nodes dropped', () => {
  const paragraph = mono(text('a = '), text('1', [{ type: 'bold' }]), { type: 'hardBreak' }, text('b'), { type: 'documentLink', attrs: { documentId: 3 } })
  expect(plainTextOf(paragraph)).toBe('a = 1\nb')
  expect((monospaceToCodeBlocks(doc(paragraph)).content as DocNode[])[1]).toEqual({ type: 'codeBlock', content: [{ type: 'text', text: 'a = 1\nb' }] })
})

test('an empty Monospace paragraph becomes an empty code block', () => {
  expect((monospaceToCodeBlocks(doc({ type: 'paragraph', attrs: { style: 'monospace' } })).content as DocNode[])[1]).toEqual({ type: 'codeBlock' })
})

test('each Monospace paragraph becomes its own block, in place, and other blocks are untouched', () => {
  const body: DocNode = { type: 'paragraph', content: [text('prose')] }
  const quote: DocNode = { type: 'paragraph', attrs: { style: 'quote' }, content: [text('q')] }
  const existing: DocNode = { type: 'codeBlock', attrs: { language: 'ruby' }, content: [text('puts 1')] }
  const converted = monospaceToCodeBlocks(doc(body, mono(text('a')), mono(text('b')), quote, existing)).content as DocNode[]
  expect(converted.map((n) => n.type)).toEqual(['heading', 'paragraph', 'codeBlock', 'codeBlock', 'paragraph', 'codeBlock'])
  expect(converted[1]).toBe(body)
  expect(converted[4]).toBe(quote)
  expect(converted[5]).toBe(existing)
})

test('a code block that already has a language keeps it, and a custom style built on Monospace stays a paragraph', () => {
  const custom: DocNode = { type: 'paragraph', attrs: { style: 'custom-3', styleName: 'Mine', styleProps: '{"base":"monospace"}' }, content: [text('x')] }
  const input = doc(custom, { type: 'codeBlock', attrs: { language: 'swift' }, content: [text('let a = 1')] })
  expect(monospaceToCodeBlocks(input)).toBe(input)
})

test('it reaches the cells of a table, but not a list item or a checklist line, whose first child must be a paragraph', () => {
  const cell = (child: DocNode): DocNode => ({ type: 'tableCell', content: [child] })
  const table: DocNode = { type: 'table', content: [{ type: 'tableRow', content: [cell(mono(text('in a cell')))] }] }
  const list: DocNode = { type: 'bulletList', content: [{ type: 'listItem', content: [mono(text('in a list'))] }] }
  const tasks: DocNode = { type: 'workspaceTaskList', content: [{ type: 'workspaceTaskItem', content: [mono(text('in a task'))] }] }
  const converted = monospaceToCodeBlocks(doc(table, list, tasks)).content as DocNode[]
  const firstCell = ((converted[1].content as DocNode[])[0].content as DocNode[])[0]
  expect((firstCell.content as DocNode[])[0].type).toBe('codeBlock')
  expect(converted[2]).toBe(list)
  expect(converted[3]).toBe(tasks)
})

test('a document with nothing to change comes back as the same object, input is never mutated', () => {
  const plain = doc({ type: 'paragraph', content: [text('hi')] })
  expect(monospaceToCodeBlocks(plain)).toBe(plain)
  const withMono = doc(mono(text('x')))
  const before = JSON.stringify(withMono)
  monospaceToCodeBlocks(withMono)
  expect(JSON.stringify(withMono)).toBe(before)
})

test('something that is not a document is returned as it is', () => {
  expect(monospaceToCodeBlocks(null)).toBeNull()
  expect(monospaceToCodeBlocks(undefined)).toBeUndefined()
  const other = { type: 'paragraph', attrs: { style: 'monospace' } }
  expect(monospaceToCodeBlocks(other)).toBe(other)
})

test('isMonospaceParagraph is true only for a paragraph styled monospace', () => {
  expect(isMonospaceParagraph(mono())).toBe(true)
  expect(isMonospaceParagraph({ type: 'paragraph', attrs: { style: 'body' } })).toBe(false)
  expect(isMonospaceParagraph({ type: 'heading', attrs: { style: 'monospace' } })).toBe(false)
})
