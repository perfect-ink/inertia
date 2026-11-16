import '@testing-library/jest-dom'
import { render, screen, within } from '@testing-library/react'
import { CrossProjectLinks } from './CrossProjectLinks'
import type { Folder, TaskDependency, TaskLink } from '@/types'

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => <a href={to} {...props}>{children}</a>,
}))

const mockFolder = (id: number, name: string) => ({ id, name, kind: 'project', children: [], documents: [], parent_id: null }) as unknown as Folder
let mockDependencies: TaskDependency[]
jest.mock('@/api/taskDependencies', () => ({ useTaskDependencies: () => ({ data: mockDependencies }) }))
jest.mock('@/api/workspace', () => ({ useWorkspace: () => ({ data: { folders: [mockFolder(1, 'Messages'), mockFolder(3, 'Billing')] } }) }))

const task = (id: number, title: string, folder_id: number, start_date: string, due_date: string) =>
  ({ id, title, status: 'todo', start_date, due_date, folder_id }) as TaskLink
const link = (id: number, predecessor: TaskLink, successor: TaskLink): TaskDependency =>
  ({ id, predecessor_id: predecessor.id, successor_id: successor.id, kind: 'finish_to_start', created_at: '', predecessor, successor })

const vendor = task(8, 'Vendor contract', 3, '2026-11-01', '2026-11-12')
const build = task(1, 'Build', 1, '2026-11-10', '2026-11-20')
const launch = task(2, 'Launch', 3, '2026-11-25', '2026-11-30')
const wireframes = task(3, 'Wireframes', 1, '2026-11-01', '2026-11-05')

test('shows nothing when no link crosses products', () => {
  mockDependencies = [link(1, wireframes, build)]
  const { container } = render(<CrossProjectLinks />)
  expect(container).toBeEmptyDOMElement()
})

test('lists each link with both products, the broken ones first and flagged in words', () => {
  mockDependencies = [link(1, build, launch), link(2, vendor, build), link(3, wireframes, build)]
  render(<CrossProjectLinks />)
  expect(screen.getByRole('heading', { name: 'Links between products' })).toBeInTheDocument()
  expect(screen.getByText(/2 links, 1 with dates that break the link/)).toBeInTheDocument()

  const [first, second] = screen.getAllByRole('listitem')
  // Build starts on the 10th but the vendor finishes on the 12th.
  expect(first).toHaveTextContent('Build (Messages) waits on Vendor contract (Billing)')
  expect(first).toHaveTextContent('Finish to start · Vendor contract due Nov 12')
  expect(first).toHaveTextContent('Dates break this link by 2 days')
  expect(within(first).getByRole('link', { name: 'Messages' })).toHaveAttribute('href', '/folders/1?view=overview')
  expect(within(first).getByRole('link', { name: 'Billing' })).toHaveAttribute('href', '/folders/3?view=overview')

  expect(second).toHaveTextContent('Launch (Billing) waits on Build (Messages)')
  expect(second).not.toHaveTextContent('Dates break')
})
