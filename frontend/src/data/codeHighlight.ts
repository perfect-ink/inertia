// Syntax highlighting for code blocks (docs/features/code_blocks.md). `highlight` is
// the one function the editor calls to find the colored parts of a block's text; it
// returns token ranges and nothing else, so the editor draws them as decorations and
// the document itself never carries them (collaborators, copies and exports see
// plain text with a `language` attribute, nothing more).
//
// The first version is the small tokenizer below, with no highlighting package
// (Alex's call to add one, see the task's Blocked note). To swap in a real
// highlighter such as lowlight (highlight.js), replace the body of `highlight`
// with a call that returns CodeToken[] for the same `code` and language id; the
// rest (the plugin, the styles, the language list) does not change.

import { normalizeCodeLanguage } from './codeLanguage'

// What a stretch of code is. Each type has one color in CodeBlockView.scss, all taken
// from the theme's AA-checked text tokens, so the colors follow light and dark.
export type CodeTokenType = 'comment' | 'string' | 'number' | 'keyword' | 'literal' | 'name' | 'attribute'

export const CODE_TOKEN_TYPES: CodeTokenType[] = ['comment', 'string', 'number', 'keyword', 'literal', 'name', 'attribute']

// A colored range of the block's text: `from` and `to` are offsets into it.
export interface CodeToken {
  from: number
  to: number
  type: CodeTokenType
}

// A block longer than this is left uncolored, so one huge paste can't freeze typing.
export const MAX_HIGHLIGHT_LENGTH = 20000

// A rule matches at the current position (it is sticky). A rule with no type only
// consumes the text, so a word is never cut up (the 12 in `abc12`). `group` colors
// only that capture group; `inside` tokenizes the matched text with another grammar.
interface Rule {
  type: CodeTokenType | null
  re: RegExp
  group?: number
  inside?: Rule[]
}

type Grammar = Rule[]

const rule = (type: CodeTokenType | null, re: RegExp, extra: Partial<Rule> = {}, flags = ''): Rule => ({
  type,
  re: new RegExp(re.source, `${flags}${re.flags.replace(/[gy]/g, '')}y`),
  ...extra,
})

const words = (list: string) => list.split(' ').join('|')
const keywordRe = (list: string) => new RegExp(`\\b(?:${words(list)})\\b`)

// Pieces shared by several grammars. Strings end at the closing quote, the line's end
// or the text's end, so a half-typed string does not color the rest of the block.
const DOUBLE_QUOTED = /"(?:[^"\\\n]|\\[\s\S])*(?:"|(?=\n)|$)/
const SINGLE_QUOTED = /'(?:[^'\\\n]|\\[\s\S])*(?:'|(?=\n)|$)/
const BACKTICKED = /`(?:[^`\\]|\\[\s\S])*(?:`|$)/
const NUMBER = /\b(?:0[xX][\da-fA-F_]+|0[bB][01_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?)\b/
const BLOCK_COMMENT = /\/\*[\s\S]*?(?:\*\/|$)/
const SLASH_COMMENT = /\/\/[^\n]*/
const HASH_COMMENT = /#[^\n]*/
const DOLLAR_IDENTIFIER = /[A-Za-z_$][\w$]*/
const CALL = /\b[A-Za-z_$][\w$]*(?=\()/
const TYPE_NAME = /\b[A-Z][\w$]*/

const JS_KEYWORDS = 'break case catch class const continue debugger default delete do else export extends finally for from function if import in instanceof let new of return static super switch this throw try typeof var void while with yield async await get set'
const TS_KEYWORDS = 'interface type enum implements namespace declare abstract public private protected readonly as is keyof infer satisfies override'

const javascript = (extraKeywords = ''): Grammar => [
  rule('comment', SLASH_COMMENT), rule('comment', BLOCK_COMMENT),
  rule('string', DOUBLE_QUOTED), rule('string', SINGLE_QUOTED), rule('string', BACKTICKED),
  rule('keyword', keywordRe(`${JS_KEYWORDS} ${extraKeywords}`.trim())),
  rule('literal', keywordRe('true false null undefined NaN Infinity')),
  rule('name', CALL), rule('name', TYPE_NAME), rule(null, DOLLAR_IDENTIFIER),
  rule('number', NUMBER),
]

const ruby: Grammar = [
  rule('comment', HASH_COMMENT),
  rule('string', DOUBLE_QUOTED), rule('string', SINGLE_QUOTED),
  rule('keyword', keywordRe('alias and begin break case class def do else elsif end ensure for if in module next not or redo rescue retry return self super then undef unless until when while yield require require_relative include extend attr_reader attr_writer attr_accessor private protected public raise lambda proc puts')),
  rule('literal', keywordRe('true false nil')),
  rule('literal', /(?<![:\w]):[A-Za-z_]\w*[?!]?/),
  rule('attribute', /@@?\w+/),
  rule('name', TYPE_NAME), rule(null, /[A-Za-z_]\w*[?!]?/),
  rule('number', NUMBER),
]

const python: Grammar = [
  rule('comment', HASH_COMMENT),
  rule('string', /"""[\s\S]*?(?:"""|$)/), rule('string', /'''[\s\S]*?(?:'''|$)/),
  rule('string', DOUBLE_QUOTED), rule('string', SINGLE_QUOTED),
  rule('attribute', /@[A-Za-z_][\w.]*/),
  rule('keyword', keywordRe('and as assert async await break class continue def del elif else except finally for from global if import in is lambda match case nonlocal not or pass raise return try while with yield')),
  rule('literal', keywordRe('True False None')),
  rule('name', CALL), rule('name', TYPE_NAME), rule(null, /[A-Za-z_]\w*/),
  rule('number', NUMBER),
]

const swift: Grammar = [
  rule('comment', SLASH_COMMENT), rule('comment', BLOCK_COMMENT),
  rule('string', /"""[\s\S]*?(?:"""|$)/), rule('string', DOUBLE_QUOTED),
  rule('attribute', /[@#][A-Za-z_]\w*/),
  rule('keyword', keywordRe('actor associatedtype async await break case catch class continue default defer deinit do else enum extension fallthrough fileprivate final for func guard if import in indirect init inout internal is lazy let mutating nonisolated nonmutating open operator override private protocol public repeat required rethrows return self Self static struct subscript super switch throw throws try typealias var weak where while some any')),
  rule('literal', keywordRe('true false nil')),
  rule('name', CALL), rule('name', TYPE_NAME), rule(null, /[A-Za-z_]\w*/),
  rule('number', NUMBER),
]

const sql: Grammar = [
  rule('comment', /--[^\n]*/), rule('comment', BLOCK_COMMENT),
  rule('string', /'(?:[^']|'')*(?:'|$)/),
  rule('name', /"(?:[^"]|"")*(?:"|$)/),
  rule('keyword', keywordRe('select from where and or not in is like between join left right inner outer full cross on as group by order having limit offset insert into values update set delete create table alter drop index view primary key foreign references unique default check constraint distinct union all case when then else end exists asc desc with returning begin commit rollback transaction add column int integer text varchar boolean timestamp date serial bigint decimal float'), {}, 'i'),
  rule('literal', keywordRe('true false null'), {}, 'i'),
  rule('name', /\b[A-Za-z_]\w*(?=\()/), rule(null, /[A-Za-z_]\w*/),
  rule('number', NUMBER),
]

const json: Grammar = [
  rule('attribute', /"(?:[^"\\\n]|\\[\s\S])*"(?=\s*:)/, {}),
  rule('string', DOUBLE_QUOTED),
  rule('literal', keywordRe('true false null')),
  rule(null, /[A-Za-z_]\w*/),
  rule('number', /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/),
]

const yaml: Grammar = [
  rule('comment', /(?<![^\s])#[^\n]*/),
  rule('keyword', /^(?:---|\.\.\.)(?=\s|$)/, {}, 'm'),
  rule('attribute', /^[ \t]*(?:-[ \t]+)*("[^"\n]*"|'[^'\n]*')(?=[ \t]*:)/, { group: 1 }, 'm'),
  rule('attribute', /^[ \t]*(?:-[ \t]+)*([^\s#:'"{}[\],&*!|>%@`-][^:#\n]*?)(?=:(?:[ \t]|$))/, { group: 1 }, 'm'),
  rule('string', DOUBLE_QUOTED), rule('string', SINGLE_QUOTED),
  rule('name', /[&*][\w-]+/),
  rule('literal', keywordRe('true false null yes no on off')), rule('literal', /~(?=\s|$)/),
  rule(null, /[A-Za-z_][\w.-]*/),
  rule('number', NUMBER),
]

// A tag is tokenized on its own, so quotes and `=` in the text around it stay plain.
const htmlTag: Grammar = [
  rule('name', /<\/?[A-Za-z][\w:.-]*/),
  rule('attribute', /[\w:@.-]+(?=\s*=)/),
  rule('string', DOUBLE_QUOTED), rule('string', SINGLE_QUOTED),
]

const html: Grammar = [
  rule('comment', /<!--[\s\S]*?(?:-->|$)/),
  rule('keyword', /<![A-Za-z][^>]*>?/),
  rule(null, /<\/?[A-Za-z][^<>"']*(?:(?:"[^"]*"|'[^']*')[^<>"']*)*>?/, { inside: htmlTag }),
  rule('literal', /&#?\w+;/),
]

const css: Grammar = [
  rule('comment', BLOCK_COMMENT),
  rule('string', DOUBLE_QUOTED), rule('string', SINGLE_QUOTED),
  rule('keyword', /@[\w-]+/), rule('keyword', /!important\b/),
  rule('attribute', /--[\w-]+/),
  // A property is a name before a colon that a `;` or `}` follows (not `a:hover {`); the lookahead is capped so it stays fast.
  rule('attribute', /-?[A-Za-z_][\w-]*(?=\s*:(?!:)[^;{}]{0,300}(?:;|\}|$))/),
  rule('number', /#[\da-fA-F]{3,8}\b/),
  rule('name', /[.#][A-Za-z_-][\w-]*/), rule('name', /[A-Za-z_-][\w-]*(?=\()/),
  rule(null, /-?[A-Za-z_][\w-]*/),
  rule('number', /[+-]?(?:\d*\.)?\d+(?:%|[A-Za-z]+)?/),
]

const shell: Grammar = [
  rule('comment', /(?<![^\s])#[^\n]*/),
  rule('string', /"(?:[^"\\]|\\[\s\S])*(?:"|$)/), rule('string', /'[^']*(?:'|$)/),
  rule('attribute', /\$(?:\{[^}\n]*\}?|[A-Za-z_]\w*|[@#?*!$0-9-])/),
  rule('literal', /(?<![^\s])--?[A-Za-z][\w-]*/),
  rule('keyword', /(?<![\w-])(?:if|then|else|elif|fi|for|while|until|do|done|case|esac|in|function|select|time|return|exit|break|continue|local|export|readonly|declare|unset|source)(?![\w-])/),
  rule('number', /(?<![\w.-])\d+(?![\w.-])/),
  rule(null, /[\w./~-]+/),
]

const markdown: Grammar = [
  rule('comment', /^[ \t]*(?:```|~~~)[^\n]*/, {}, 'm'), rule('comment', /^>[^\n]*/, {}, 'm'),
  rule('keyword', /^#{1,6}[ \t][^\n]*/, {}, 'm'), rule('keyword', /^[ \t]*(?:[-*+]|\d+\.)(?=[ \t])/, {}, 'm'),
  rule('string', /`[^`\n]*`?/),
  rule('attribute', /\*\*[^*\n]+\*\*|__[^_\n]+__/), rule('attribute', /\*[^*\s][^*\n]*\*/), rule('attribute', /(?<!\w)_[^_\s][^_\n]*_(?!\w)/),
  rule('name', /\[[^\]\n]*\]\([^)\n]*\)/),
  rule(null, /\w+/),
]

// One grammar per language in data/codeLanguage.ts (a test checks they match).
const GRAMMARS: Record<string, Grammar> = {
  javascript: javascript(),
  typescript: javascript(TS_KEYWORDS),
  ruby, python, swift, sql, json, yaml, html, css, shell, markdown,
}

export function hasGrammar(language: string): boolean {
  return Object.prototype.hasOwnProperty.call(GRAMMARS, language)
}

function tokenizeWith(grammar: Grammar, code: string, offset = 0, into: CodeToken[] = []): CodeToken[] {
  let pos = 0
  while (pos < code.length) {
    let step = 1
    for (const r of grammar) {
      r.re.lastIndex = pos
      const match = r.re.exec(code)
      if (!match || match[0].length === 0) continue
      step = match[0].length
      if (r.inside) {
        tokenizeWith(r.inside, match[0], offset + pos, into)
      } else if (r.type) {
        const text = r.group ? match[r.group] : match[0]
        if (text) {
          const from = offset + pos + (r.group ? match[0].indexOf(text) : 0)
          into.push({ from, to: from + text.length, type: r.type })
        }
      }
      break
    }
    pos += step
  }
  return into
}

// The colored ranges of `code` for a language (a stored name or id). Plain text, a
// language with no grammar and a block that is too long give none.
export function highlight(code: string, language: unknown): CodeToken[] {
  const id = normalizeCodeLanguage(language)
  if (!id || !hasGrammar(id) || code.length > MAX_HIGHLIGHT_LENGTH) return []
  return tokenizeWith(GRAMMARS[id], code)
}

// The class a token is drawn with: `code_token code_token--keyword`.
export function tokenClass(type: CodeTokenType): string {
  return `code_token code_token--${type}`
}
