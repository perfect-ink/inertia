import '@testing-library/jest-dom'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { useProjectStore } from '@/store/projects'
import { useSidebarStore } from '@/store/sidebar'
import { useAuthStore } from '@/store/auth'
import { SpaceSidebar } from './SpaceSidebar'

jest.mock('@/components/workspace/WorkspaceSwitcher', () => ({ WorkspaceSwitcher: () => <button>Space: Acme</button> }))
jest.mock('@/assets/logo-mark.svg', () => 'logo.svg')
jest.mock('@/api/folders', () => ({ useCreateFolder: () => ({ mutateAsync: jest.fn() }) }))
jest.mock('@/api/notifications', () => ({ useNotifications: () => ({ data: { unread_count: 3 } }) }))
const mockReset = jest.fn()
const mockClient = { resetQueries: mockReset }
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => mockClient }))

const project = (id: number, name: string, documents: object[] = []) => ({ id, name, kind: 'project', documents, children: [] })
const mockWorkspace = {
  folders: [{
    id: 1, name: 'Root', root: true, kind: 'folder', documents: [],
    children: [
      project(2, 'Messages', [{ id: 9, title: 'Brief', doc_type: 'document', pinned: true }]),
      project(3, 'Billing'), project(4, 'Docs'), project(5, 'Hiring'), project(6, 'Infra'), project(7, 'Legal'),
    ],
  }],
}
jest.mock('@/api/workspace', () => ({ useWorkspace: () => ({ data: mockWorkspace }) }))

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

const onSignOut = jest.fn()
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="*" element={<><SpaceSidebar accountItems={[{ key: 'out', label: 'Sign out', onSelect: onSignOut }]} /><Where /></>} /></Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  useProjectStore.setState({ activeProjectId: null, recentIds: [] })
  useSidebarStore.setState({ collapsed: false })
  useAuthStore.setState({ user: { id: 1, name: 'Ada Lovelace', email: 'ada@example.com' } } as never)
})

test('lists the recently opened products first, then the rest by name, five at most, with a link to them all', () => {
  useProjectStore.setState({ recentIds: [5, 3] })
  renderAt('/space')
  const list = screen.getByRole('list', { name: 'Products' })
  expect(within(list).getAllByRole('link').map((a) => a.textContent)).toEqual(['Hiring', 'Billing', 'Docs', 'Infra', 'Legal'])
  expect(screen.getByRole('link', { name: 'All products' })).toHaveAttribute('href', '/space')
})

test('picking a product opens it and makes it the most recent', () => {
  renderAt('/space')
  fireEvent.click(screen.getByRole('link', { name: 'Billing' }))
  expect(useProjectStore.getState().activeProjectId).toBe(3)
  expect(useProjectStore.getState().recentIds[0]).toBe(3)
  expect(screen.getByTestId('where')).toHaveTextContent('/folders/3')
})

test('opening a document inside a product opens that product', () => {
  renderAt('/documents/9')
  expect(useProjectStore.getState().activeProjectId).toBe(2)
})

test('shows pinned documents, the inbox and the profile menu', () => {
  renderAt('/space')
  expect(screen.getByRole('link', { name: 'Brief' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Inbox (3 unread)' })).toHaveAttribute('href', '/inbox')
  fireEvent.click(screen.getByRole('button', { name: 'Account: Ada Lovelace' }))
  fireEvent.click(screen.getByRole('menuitem', { name: /Sign out/ }))
  expect(onSignOut).toHaveBeenCalled()
})

test('collapses to icons with tooltips, and remembers it', () => {
  renderAt('/space')
  fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
  expect(useSidebarStore.getState().collapsed).toBe(true)
  expect(screen.getByRole('navigation', { name: 'Space' })).toHaveClass('ui-space_sidebar--collapsed')
  expect(screen.getByRole('link', { name: 'Billing' })).toHaveAttribute('title', 'Billing')
  fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }))
  expect(screen.getByRole('link', { name: 'Billing' })).not.toHaveAttribute('title')
})
