import { CODE_LANGUAGES } from './codeLanguage'
import { CODE_TOKEN_TYPES, MAX_HIGHLIGHT_LENGTH, hasGrammar, highlight, tokenClass, type CodeTokenType } from './codeHighlight'

// The tokens of `code` as [text, type] pairs, so a test reads like the code it colors.
function pairs(code: string, language: string): [string, CodeTokenType][] {
  return highlight(code, language).map((t) => [code.slice(t.from, t.to), t.type])
}

test('every language in the menu has a grammar', () => {
  for (const { id } of CODE_LANGUAGES) expect(hasGrammar(id)).toBe(true)
})

test('plain text, no language and a language with no grammar are left uncolored', () => {
  expect(highlight('const a = 1', null)).toEqual([])
  expect(highlight('const a = 1', '')).toEqual([])
  expect(highlight('const a = 1', 'text')).toEqual([])
  expect(highlight('fn main() {}', 'rust')).toEqual([])
})

test('an alias is colored as its language', () => {
  expect(highlight('const a = 1', 'js')).toEqual(highlight('const a = 1', 'javascript'))
  expect(highlight('const a = 1', 'js').length).toBeGreaterThan(0)
})

test('ranges stay inside the text, in order, never overlapping, with a known type', () => {
  const samples: Record<string, string> = {
    javascript: 'export const f = (a) => `x${a}` // done\n/* c */ if (a > 1) { return "s" }',
    typescript: 'interface A { b: number }\nconst c: A = { b: 1 } as A',
    ruby: 'class A\n  def b(x) = @y ||= :z # c\nend',
    python: '@dec\ndef f(a):\n    """doc"""\n    return None  # c',
    swift: 'struct A { let b: Int = 1 }\n@main enum E {}',
    sql: "SELECT a, count(*) FROM t WHERE b = 'x' -- c\nORDER BY a;",
    json: '{"a": [1, 2.5e3, true, null], "b": "x"}',
    yaml: 'a: 1\nb:\n  - c: "d" # e\n  - &x f',
    html: '<!-- c --><div class="a" id=\'b\'>x &amp; y</div>',
    css: '/* c */\n.a:hover { color: #fff; margin: 0 12px !important }',
    shell: '#!/bin/sh\nif [ -f "$A" ]; then echo ${B} -n; fi',
    markdown: '# Title\n\n- **bold** and `code` and [a](b)\n> quote',
  }
  for (const { id } of CODE_LANGUAGES) {
    const code = samples[id]
    expect(code).toBeDefined()
    const tokens = highlight(code, id)
    expect(tokens.length).toBeGreaterThan(0)
    let end = 0
    for (const token of tokens) {
      expect(token.from).toBeGreaterThanOrEqual(end)
      expect(token.to).toBeGreaterThan(token.from)
      expect(token.to).toBeLessThanOrEqual(code.length)
      expect(CODE_TOKEN_TYPES).toContain(token.type)
      end = token.to
    }
  }
})

describe('JavaScript and TypeScript', () => {
  test('colors keywords, strings, numbers, comments, literals and names', () => {
    expect(pairs('const n = 42 // answer', 'javascript')).toEqual([['const', 'keyword'], ['42', 'number'], ['// answer', 'comment']])
    expect(pairs('if (ok) return "a" + \'b\' + `c`', 'javascript')).toEqual([
      ['if', 'keyword'], ['return', 'keyword'], ['"a"', 'string'], ["'b'", 'string'], ['`c`', 'string'],
    ])
    expect(pairs('x = null; new Map(a)', 'javascript')).toEqual([['null', 'literal'], ['new', 'keyword'], ['Map', 'name']])
    expect(pairs('log(a)', 'javascript')).toEqual([['log', 'name']])
  })

  test('never colors part of a word', () => {
    expect(pairs('ifelse constant a12 _1', 'javascript')).toEqual([])
  })

  test('TypeScript adds its own keywords, JavaScript does not', () => {
    expect(pairs('interface A {}', 'typescript')).toEqual([['interface', 'keyword'], ['A', 'name']])
    expect(pairs('interface', 'javascript')).toEqual([])
  })

  test('a block comment can span lines, and an unfinished one runs to the end', () => {
    expect(pairs('a /* x\ny */ b', 'javascript')).toEqual([['/* x\ny */', 'comment']])
    expect(pairs('a /* x\ny', 'javascript')).toEqual([['/* x\ny', 'comment']])
  })

  test('a half-typed string ends with its line, so the next line is still colored', () => {
    expect(pairs('a = "oops\nconst b', 'javascript')).toEqual([['"oops', 'string'], ['const', 'keyword']])
  })

  test('an escaped quote does not end the string', () => {
    expect(pairs('"a\\"b" 1', 'javascript')).toEqual([['"a\\"b"', 'string'], ['1', 'number']])
  })
})

test('Ruby: keywords, symbols, instance variables, constants and comments', () => {
  expect(pairs('def x; @a = :b # hi', 'ruby')).toEqual([['def', 'keyword'], ['@a', 'attribute'], [':b', 'literal'], ['# hi', 'comment']])
  expect(pairs('Foo::Bar.new', 'ruby')).toEqual([['Foo', 'name'], ['Bar', 'name']])
})

test('Python: docstrings, decorators and None', () => {
  expect(pairs('@app.route\ndef f(): return None', 'python')).toEqual([
    ['@app.route', 'attribute'], ['def', 'keyword'], ['f', 'name'], ['return', 'keyword'], ['None', 'literal'],
  ])
  expect(pairs('"""a\nb"""', 'python')).toEqual([['"""a\nb"""', 'string']])
})

test('Swift: attributes, types and nil', () => {
  expect(pairs('@State var x: Int? = nil', 'swift')).toEqual([['@State', 'attribute'], ['var', 'keyword'], ['Int', 'name'], ['nil', 'literal']])
})

test('SQL: keywords in any case, quoted names, doubled quotes inside a string', () => {
  expect(pairs("select * from \"t\" where a = 'it''s' and b is null", 'sql')).toEqual([
    ['select', 'keyword'], ['from', 'keyword'], ['"t"', 'name'], ['where', 'keyword'], ["'it''s'", 'string'],
    ['and', 'keyword'], ['is', 'keyword'], ['null', 'literal'],
  ])
  expect(pairs('-- note\nSELECT 1', 'sql')).toEqual([['-- note', 'comment'], ['SELECT', 'keyword'], ['1', 'number']])
})

test('JSON: keys apart from string values, numbers and literals', () => {
  expect(pairs('{"a": "b", "c": [1, -2.5, false, null]}', 'json')).toEqual([
    ['"a"', 'attribute'], ['"b"', 'string'], ['"c"', 'attribute'], ['1', 'number'], ['-2.5', 'number'], ['false', 'literal'], ['null', 'literal'],
  ])
})

test('YAML: keys, comments, quoted keys, anchors and literals', () => {
  expect(pairs('name: Inertia # app\nlist:\n  - id: 7\n  - on', 'yaml')).toEqual([
    ['name', 'attribute'], ['# app', 'comment'], ['list', 'attribute'], ['id', 'attribute'], ['7', 'number'], ['on', 'literal'],
  ])
  expect(pairs('"a b": &x yes', 'yaml')).toEqual([['"a b"', 'attribute'], ['&x', 'name'], ['yes', 'literal']])
  // A # inside a word is not a comment.
  expect(pairs('url: a#b', 'yaml')).toEqual([['url', 'attribute']])
})

test('HTML: only a tag\'s own quotes and equals sign count, not the text around it', () => {
  expect(pairs('<a href="x" hidden>it\'s a = b</a>', 'html')).toEqual([
    ['<a', 'name'], ['href', 'attribute'], ['"x"', 'string'], ['</a', 'name'],
  ])
  expect(pairs('<!-- hi --> &amp;', 'html')).toEqual([['<!-- hi -->', 'comment'], ['&amp;', 'literal']])
  expect(pairs('<!doctype html>', 'html')).toEqual([['<!doctype html>', 'keyword']])
})

test('CSS: a pseudo-class is not a property, a declaration is', () => {
  expect(pairs('a:hover { color: #fff; margin: 0 12px }', 'css')).toEqual([
    ['color', 'attribute'], ['#fff', 'number'], ['margin', 'attribute'], ['0', 'number'], ['12px', 'number'],
  ])
})

test('CSS: classes, custom properties, at-rules and !important', () => {
  expect(pairs('@media (x) { .a { --b: 1 !important } }', 'css')).toEqual([
    ['@media', 'keyword'], ['.a', 'name'], ['--b', 'attribute'], ['1', 'number'], ['!important', 'keyword'],
  ])
})

test('shell: comments only at a word start, variables, flags, keywords and strings', () => {
  expect(pairs('if [ -f "$A" ]; then echo a#b $HOME --all # done', 'shell')).toEqual([
    ['if', 'keyword'], ['-f', 'literal'], ['"$A"', 'string'], ['then', 'keyword'], ['$HOME', 'attribute'], ['--all', 'literal'], ['# done', 'comment'],
  ])
  expect(pairs('do-it 12', 'shell')).toEqual([['12', 'number']])
})

test('Markdown: headings, lists, code, emphasis and links; snake_case is not emphasis', () => {
  expect(pairs('# Hi\n- a `b` **c** [d](e)\nsnake_case_name', 'markdown')).toEqual([
    ['# Hi', 'keyword'], ['-', 'keyword'], ['`b`', 'string'], ['**c**', 'attribute'], ['[d](e)', 'name'],
  ])
})

test('a very long block is left uncolored', () => {
  expect(highlight(`const a = 1;${' '.repeat(MAX_HIGHLIGHT_LENGTH)}`, 'javascript')).toEqual([])
})

test('a pathological block finishes fast', () => {
  const started = Date.now()
  const hostile = [
    'a:'.repeat(5000), '"'.repeat(5000), '/*'.repeat(5000), '<a '.repeat(3000), "'".repeat(5000) + '\n'.repeat(100),
  ]
  for (const { id } of CODE_LANGUAGES) for (const code of hostile) highlight(code, id)
  expect(Date.now() - started).toBeLessThan(3000)
})

test('a token is drawn with a code_token class and its type', () => {
  expect(tokenClass('keyword')).toBe('code_token code_token--keyword')
})
