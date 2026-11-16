import '@testing-library/jest-dom'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import type { NodeViewProps } from '@tiptap/react'
import { CODE_TOKEN_TYPES } from '@/data/codeHighlight'
import { CODE_LANGUAGES } from '@/data/codeLanguage'
import CodeBlockView from './CodeBlockView'

jest.mock('@tiptap/react', () => ({
  NodeViewWrapper: ({ children, className }: { children: ReactNode; className?: string }) => <div className={className}>{children}</div>,
  NodeViewContent: ({ as: Tag = 'div', className }: { as?: string; className?: string }) => {
    const Content = Tag as 'code'
    return <Content data-testid="content" className={className}>let a = 1</Content>
  },
}))

function view(language: string | null, editable = true) {
  const updateAttributes = jest.fn()
  const props = { node: { attrs: { language } }, editor: { isEditable: editable }, updateAttributes } as unknown as NodeViewProps
  return { updateAttributes, ...render(<CodeBlockView {...props} />) }
}

test('has a language menu on the block, plain text by default', () => {
  view(null)
  const menu = screen.getByLabelText('Code language')
  expect(menu).toHaveValue('')
  const options = Array.from(menu.querySelectorAll('option')).map((o) => o.textContent)
  expect(options).toEqual(['Plain text', ...CODE_LANGUAGES.map((l) => l.label)])
})

test('shows the block\'s language, and an alias as the language it means', () => {
  const { unmount } = view('ruby')
  expect(screen.getByLabelText('Code language')).toHaveValue('ruby')
  unmount()
  view('js')
  expect(screen.getByLabelText('Code language')).toHaveValue('javascript')
})

test('the <code> carries a stable language-<id> class, and none for plain text', () => {
  const { unmount } = view('py')
  expect(screen.getByTestId('content')).toHaveClass('language-python')
  unmount()
  view(null)
  expect(screen.getByTestId('content').className).toBe('')
})

test('choosing a language saves it on the block, and plain text clears it', () => {
  const { updateAttributes } = view('ruby')
  const menu = screen.getByLabelText('Code language')
  fireEvent.change(menu, { target: { value: 'sql' } })
  expect(updateAttributes).toHaveBeenLastCalledWith({ language: 'sql' })
  fireEvent.change(menu, { target: { value: '' } })
  expect(updateAttributes).toHaveBeenLastCalledWith({ language: null })
})

test('a language the list lacks stays selected under its own name', () => {
  view('rust')
  const menu = screen.getByLabelText('Code language')
  expect(menu).toHaveValue('rust')
  expect(screen.getByRole('option', { name: 'rust' })).toBeInTheDocument()
})

test('the menu is not editable text: it sits outside the code, and is disabled in a document that cannot be edited', () => {
  const { container } = view('ruby', false)
  expect(screen.getByLabelText('Code language')).toBeDisabled()
  expect(container.querySelector('.code_block-bar')).toHaveAttribute('contenteditable', 'false')
  expect(container.querySelector('.code_block-bar')?.contains(screen.getByTestId('content'))).toBe(false)
})

describe('token colors', () => {
  const css = readFileSync(join(__dirname, 'CodeBlockView.scss'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

  test('every token type has a color', () => {
    for (const type of CODE_TOKEN_TYPES) expect(css).toMatch(new RegExp(`&--${type}\\b`))
  })

  test('each color is a theme status text token, which is checked at 4.5:1 in light and dark (statusColors.test.ts)', () => {
    const tokens = css.slice(css.indexOf('.code_token'))
    const colors = [...tokens.matchAll(/(?<![-\w])color:\s*([^;]+);/g)].map((m) => m[1].trim())
    expect(colors.length).toBeGreaterThanOrEqual(CODE_TOKEN_TYPES.length - 1)
    for (const value of colors) expect(value).toMatch(/^color\(status-(gray|green|orange|purple|blue|yellow)-text\)$/)
  })

  test('uses no fixed color', () => {
    expect(css).not.toMatch(/#[\da-fA-F]{3,8}\b|rgb\(|hsl\(|palette\(/)
  })
})
