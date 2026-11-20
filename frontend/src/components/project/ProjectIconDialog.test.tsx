import '@testing-library/jest-dom'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { Folder } from '@/types'
import ProjectIconDialog from './ProjectIconDialog'

const mockUpdate = jest.fn()
jest.mock('@/api/folders', () => ({ useUpdateFolder: () => ({ mutate: mockUpdate }) }))
jest.mock('@/api/uploads', () => ({ uploadFile: jest.fn() }))

const project = { id: 4, name: 'Messages', icon: '\u{1F680}', image_url: null } as unknown as Folder

test('offers monochrome icons, never emojis, and saves the one picked by name', () => {
  render(<ProjectIconDialog project={project} onClose={() => {}} />)
  const icons = screen.getByRole('group', { name: 'Icons' })
  expect(within(icons).getByRole('button', { name: 'Rocket' })).toHaveAttribute('aria-pressed', 'true')
  expect(icons.textContent).toBe('')
  expect(screen.queryByText(/emoji/i)).toBeNull()
  fireEvent.click(within(icons).getByRole('button', { name: 'Bug' }))
  expect(mockUpdate).toHaveBeenCalledWith({ id: 4, icon: 'bug', image_url: null }, expect.anything())
})
