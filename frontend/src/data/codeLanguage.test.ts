import {
  CODE_LANGUAGES, PLAIN_TEXT_LABEL, codeLanguageClass, codeLanguageOf, codeLanguageOptions, codeLanguageValue, normalizeCodeLanguage,
} from './codeLanguage'

test('offers the common languages once each, with a label', () => {
  expect(CODE_LANGUAGES.map((l) => l.label)).toEqual([
    'JavaScript', 'TypeScript', 'Ruby', 'Python', 'Swift', 'SQL', 'JSON', 'YAML', 'HTML', 'CSS', 'Shell', 'Markdown',
  ])
  expect(new Set(CODE_LANGUAGES.map((l) => l.id)).size).toBe(CODE_LANGUAGES.length)
})

test('ids are lowercase words, and no name (id or alias) belongs to two languages', () => {
  const names = CODE_LANGUAGES.flatMap((l) => [l.id, ...l.aliases])
  expect(new Set(names).size).toBe(names.length)
  for (const name of names) expect(name).toMatch(/^[a-z]+$/)
})

test('a name or alias means its language, in any case', () => {
  expect(normalizeCodeLanguage('javascript')).toBe('javascript')
  expect(normalizeCodeLanguage('JS')).toBe('javascript')
  expect(normalizeCodeLanguage(' tsx ')).toBe('typescript')
  expect(normalizeCodeLanguage('sh')).toBe('shell')
  expect(normalizeCodeLanguage('bash')).toBe('shell')
  expect(normalizeCodeLanguage('yml')).toBe('yaml')
  expect(normalizeCodeLanguage('md')).toBe('markdown')
})

test('no language, or one that means none, is plain text', () => {
  for (const none of [null, undefined, '', '  ', 'text', 'plaintext', 'TXT', 3, {}]) expect(normalizeCodeLanguage(none)).toBeNull()
})

test('a language that is not in the list is kept as written, lowercased', () => {
  expect(normalizeCodeLanguage('Rust')).toBe('rust')
  expect(codeLanguageOf('rust')).toBeUndefined()
  expect(codeLanguageOf('rb')?.label).toBe('Ruby')
})

test('the code element gets a stable language-<id> class, and plain text none', () => {
  expect(codeLanguageClass('js')).toBe('language-javascript')
  expect(codeLanguageClass('javascript')).toBe('language-javascript')
  expect(codeLanguageClass('rust')).toBe('language-rust')
  expect(codeLanguageClass(null)).toBeNull()
  expect(codeLanguageClass('text')).toBeNull()
})

test('the menu is plain text first, then the list', () => {
  const options = codeLanguageOptions(null)
  expect(options[0]).toEqual({ value: '', label: PLAIN_TEXT_LABEL })
  expect(options.slice(1)).toEqual(CODE_LANGUAGES.map((l) => ({ value: l.id, label: l.label })))
})

test('a stored language the list lacks stays in the menu under its own name, so choosing nothing loses nothing', () => {
  expect(codeLanguageOptions('rust').slice(0, 2)).toEqual([{ value: '', label: PLAIN_TEXT_LABEL }, { value: 'rust', label: 'rust' }])
  expect(codeLanguageOptions('js')).toHaveLength(CODE_LANGUAGES.length + 1)
  expect(codeLanguageOptions('js').some((o) => o.value === 'js')).toBe(false)
})

test('the menu shows an alias as the language it means', () => {
  expect(codeLanguageValue('py')).toBe('python')
  expect(codeLanguageValue('rust')).toBe('rust')
  expect(codeLanguageValue(null)).toBe('')
  expect(codeLanguageOptions('py').some((o) => o.value === codeLanguageValue('py'))).toBe(true)
})
