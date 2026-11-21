import '@testing-library/jest-dom'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { Folder } from '@/types'
import ProjectIconDialog from './ProjectIconDialog'

const mockUpdate = jest.fn()
jest.mock('@/api/folders', () => ({ useUpdateFolder: () => ({ mutate: mockUpdate }) }))
jest.mock('@/api/uploads', () => ({ uploadFile: jest.fn() }))

const project = (icon: string | null, image_url: string | null = null) => ({ id: 4, name: 'Messages', icon, image_url }) as unknown as Folder

beforeEach(() => mockUpdate.mockClear())

test('opens on line icons and saves the one picked by name', () => {
  render(<ProjectIconDialog project={project('rocket')} onClose={() => {}} />)
  const icons = screen.getByRole('group', { name: 'Icons' })
  expect(within(icons).getByRole('button', { name: 'Rocket' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(within(icons).getByRole('button', { name: 'Bug' }))
  expect(mockUpdate).toHaveBeenCalledWith({ id: 4, icon: 'bug', image_url: null }, expect.anything())
})

test('a product can have an emoji: it opens on the Emoji tab, and any emoji can be typed', () => {
  render(<ProjectIconDialog project={project('\u{1F680}')} onClose={() => {}} />)
  expect(screen.getByRole('button', { name: 'Emoji' })).toHaveAttribute('aria-pressed', 'true')
  expect(within(screen.getByRole('group', { name: 'Emojis' })).getByRole('button', { name: '\u{1F680}' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Or type any emoji' }), { key: 'Enter', target: { value: '\u{1F984}' } })
  expect(mockUpdate).toHaveBeenCalledWith({ id: 4, icon: '\u{1F984}', image_url: null }, expect.anything())
})

test('a product can have an uploaded image', () => {
  render(<ProjectIconDialog project={project(null, '/logo.png')} onClose={() => {}} />)
  expect(screen.getByRole('button', { name: 'Image' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: /Replace image/ })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Icon' }))
  expect(screen.getByRole('group', { name: 'Icons' })).toBeInTheDocument()
})
