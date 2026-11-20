import '@testing-library/jest-dom'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { useProjectStore } from '@/store/projects'
import { useSidebarStore } from '@/store/sidebar'
import type { Folder } from '@/types'
import { ProjectSidebar } from './ProjectSidebar'

jest.mock('./FolderItem', () => ({ FolderItem: ({ folder }: { folder: { name: string } }) => <p>Files of {folder.name}</p> }))
jest.mock('@/components/project/ProjectIconDialog', () => function DialogMock() { return null })
jest.mock('@/components/project/ProjectFeaturesDialog', () => function DialogMock() { return null })
const mockNewDocument = jest.fn()
jest.mock('@/hooks/useNewDocument', () => ({ useNewDocument: () => mockNewDocument }))
const mockCreateFolder = jest.fn()
jest.mock('@/api/folders', () => ({
  useCreateFolder: () => ({ mutateAsync: jest.fn(), mutate: mockCreateFolder }),
}))

const mockReset = jest.fn()
const mockClient = { resetQueries: mockReset }
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => mockClient }))

const doc = { id: 9, title: 'Brief', doc_type: 'document' }
const messages = { id: 2, name: 'Messages', kind: 'project', icon: 'rocket', documents: [doc], children: [] } as unknown as Folder
const billing = { id: 3, name: 'Billing', kind: 'project', documents: [], children: [] } as unknown as Folder
let mockShared = true
const mockWorkspace = () => ({
  shared: mockShared,
  role: 'owner',
  folders: [{ id: 1, name: 'Root', root: true, kind: 'folder', documents: [], children: [messages, billing] }],
})
jest.mock('@/api/workspace', () => ({ useWorkspace: () => ({ data: mockWorkspace() }) }))

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

function renderAt(path: string, project: Folder = messages) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="*" element={<><ProjectSidebar project={project} /><Where /></>} /></Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  mockShared = true
  useProjectStore.setState({ activeProjectId: 2, recentIds: [] })
  useSidebarStore.setState({ viewsOpen: false })
  mockNewDocument.mockClear()
})

test('shows the product, its tasks and its documents', () => {
  renderAt('/folders/2')
  expect(screen.getByRole('button', { name: 'Product: Messages. Switch product' })).toBeInTheDocument()
  expect(within(screen.getByRole('navigation', { name: 'Tasks' })).getByRole('link', { name: 'Tasks' })).toHaveAttribute('href', '/tasks?view=backlog')
  expect(screen.getByRole('link', { name: 'Documents' })).toHaveAttribute('href', '/documents')
  expect(screen.getByText('Files of Messages')).toBeInTheDocument()
})

test('a product with no documents says so', () => {
  renderAt('/folders/3', billing)
  expect(screen.getByText('No documents yet.')).toBeInTheDocument()
})

test('one + menu creates documents, sheets, Collections and folders in the product', () => {
  renderAt('/documents/9')
  const pick = (name: RegExp) => {
    fireEvent.click(screen.getByRole('button', { name: 'New' }))
    fireEvent.click(screen.getByRole('menuitem', { name }))
  }
  pick(/Document/)
  pick(/Sheet/)
  pick(/Collection/)
  expect(mockNewDocument.mock.calls).toEqual([['document', 2], ['spreadsheet', 2], ['table', 2]])

  pick(/Folder/)
  const name = screen.getByRole('textbox', { name: 'Folder name' })
  fireEvent.change(name, { target: { value: 'Drafts' } })
  fireEvent.keyDown(name, { key: 'Enter' })
  expect(mockCreateFolder).toHaveBeenCalledWith({ name: 'Drafts', parent_id: 2 }, expect.anything())
})

test('the other pages sit under Views at the bottom, folded away until opened', () => {
  renderAt('/folders/2')
  const views = screen.getByRole('navigation', { name: 'Views' })
  expect(within(views).queryByRole('link')).toBeNull()
  fireEvent.click(within(views).getByRole('button', { name: 'Views' }))
  const labels = within(views).getAllByRole('link').map((a) => a.textContent)
  expect(labels).toEqual(expect.arrayContaining(['My work', 'Task table', 'Roadmap', 'Sprints', 'OKRs', 'Workload']))
  expect(labels).not.toContain('Tasks')
  fireEvent.click(within(views).getByRole('link', { name: 'Sprints' }))
  expect(screen.getByTestId('where')).toHaveTextContent('/sprints')
})

test('the page you are on stays listed under Views even when folded', () => {
  renderAt('/okrs')
  const views = screen.getByRole('navigation', { name: 'Views' })
  expect(within(views).getAllByRole('link').map((a) => a.textContent)).toEqual(['OKRs'])
  expect(within(views).getByRole('link', { name: 'OKRs' })).toHaveAttribute('aria-current', 'page')
})

test('turned-off pages and pages only for shared Spaces are left out', () => {
  mockShared = false
  renderAt('/folders/2', { ...messages, features: ['tasks', 'roadmap', 'my_work'] } as Folder)
  fireEvent.click(screen.getByRole('button', { name: 'Views' }))
  expect(within(screen.getByRole('navigation', { name: 'Views' })).getAllByRole('link').map((a) => a.textContent)).toEqual(['Roadmap'])
})

test('a product with no other pages has no Views list', () => {
  renderAt('/folders/2', { ...messages, features: ['tasks'] } as Folder)
  expect(screen.queryByRole('navigation', { name: 'Views' })).toBeNull()
})

test('the product menu switches products and goes back to them all', () => {
  renderAt('/folders/2')
  fireEvent.click(screen.getByRole('button', { name: 'Product: Messages. Switch product' }))
  expect(screen.getByRole('menuitemradio', { name: /Messages/ })).toHaveAttribute('aria-checked', 'true')
  fireEvent.click(screen.getByRole('menuitemradio', { name: /Billing/ }))
  expect(useProjectStore.getState().activeProjectId).toBe(3)
  expect(screen.getByTestId('where')).toHaveTextContent('/folders/3')

  fireEvent.click(screen.getByRole('button', { name: 'Product: Messages. Switch product' }))
  fireEvent.click(screen.getByRole('menuitem', { name: /All products/ }))
  expect(screen.getByTestId('where')).toHaveTextContent('/space')
})
