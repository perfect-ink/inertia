import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import GanttPane from './GanttPane'
import type { DependencyMode, Folder, Task } from '@/types'

// Dragging a bar is Timeline's job (see its tests); a button per row stands in
// for it and moves that row to 3-8 November.
jest.mock('@/components/Timeline', () => ({
  Timeline: ({ items, onReschedule }: { items: { key: string }[]; onReschedule: (item: unknown, start: string, end: string) => void }) => (
    <div>
      {items.map((item) => (
        <button key={item.key} onClick={() => onReschedule(item, '2026-11-03', '2026-11-08')}>{`Move ${item.key}`}</button>
      ))}
    </div>
  ),
}))

const mockUpdateTask = { mutate: jest.fn() }
jest.mock('@/api/tasks', () => ({ useUpdateTask: () => mockUpdateTask, useTaskSearch: () => ({ data: [], isFetching: false }) }))
jest.mock('@/api/epics', () => ({ useUpdateEpic: () => ({ mutate: jest.fn() }) }))
jest.mock('@/api/workspace', () => ({ useUpdateFolder: () => ({ mutate: jest.fn() }), useWorkspace: () => ({ data: { role: 'member' } }) }))
jest.mock('@/api/savedViews', () => ({
  useSavedViews: () => ({ data: [] }),
  useCreateSavedView: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdateSavedView: () => ({ mutate: jest.fn(), isPending: false }),
  useDeleteSavedView: () => ({ mutate: jest.fn() }),
}))
jest.mock('@/api/taskDependencies', () => ({
  useTaskDependencies: () => ({ data: [{ id: 9, predecessor_id: 1, successor_id: 2, kind: 'finish_to_start', created_at: '' }] }),
  useCreateTaskDependency: () => ({ mutate: jest.fn(), isPending: false, isError: false, error: null }),
  useDeleteTaskDependency: () => ({ mutate: jest.fn() }),
}))

const task = (id: number, title: string, start_date: string, due_date: string) =>
  ({ id, title, status: 'todo', start_date, due_date, epic_id: null }) as unknown as Task

const tasks = [task(1, 'Design', '2026-11-01', '2026-11-05'), task(2, 'Build', '2026-11-06', '2026-11-20')]

const folders = [{ id: 3, name: 'Billing', kind: 'project', children: [], documents: [], parent_id: null }] as unknown as Folder[]

function renderPane(mode: DependencyMode) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <GanttPane folderId={1} dependencyMode={mode} epics={[]} tasks={tasks} milestones={[]} folders={folders} />
    </QueryClientProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Move task-1' }))
}

beforeEach(() => mockUpdateTask.mutate.mockReset())

test('block mode refuses a move that breaks a link without calling the server', () => {
  renderPane('strict')
  expect(screen.getByRole('alert')).toHaveTextContent('That would break the dependency of "Build" on "Design".')
  expect(mockUpdateTask.mutate).not.toHaveBeenCalled()
})

test('shift mode saves the moved task and the tasks pushed with it', () => {
  renderPane('flexible')
  expect(mockUpdateTask.mutate).toHaveBeenCalledTimes(2)
  expect(mockUpdateTask.mutate).toHaveBeenCalledWith({ id: 1, start_date: '2026-11-03', due_date: '2026-11-08' }, expect.anything())
  expect(mockUpdateTask.mutate).toHaveBeenCalledWith({ id: 2, start_date: '2026-11-08', due_date: '2026-11-22' }, expect.anything())
})

test('shows the reason when the server refuses a move', () => {
  mockUpdateTask.mutate.mockImplementation((_update, options) => options.onError({
    isAxiosError: true,
    response: { data: { errors: ['That would break the dependency of "Build" on "Design".'] } },
  }))
  renderPane('none')
  expect(mockUpdateTask.mutate).toHaveBeenCalledWith({ id: 1, start_date: '2026-11-03', due_date: '2026-11-08' }, expect.anything())
  expect(screen.getByRole('alert')).toHaveTextContent('That would break the dependency of "Build" on "Design".')
})

describe('tasks the server moved in other products', () => {
  // What the server answers when the dragged task has a link to another project (in shift mode).
  const answer = (...rescheduled: unknown[]) => mockUpdateTask.mutate.mockImplementation((update, options) => {
    if (update.id === 1) options.onSuccess({ ...update, rescheduled })
  })
  const vendor = { ...task(99, 'Vendor contract', '2026-11-10', '2026-11-14'), folder_id: 3 }

  test('the chart says which ones moved, with their product and new dates', () => {
    answer({ ...task(2, 'Build', '2026-11-08', '2026-11-22'), folder_id: 1 }, vendor)
    renderPane('flexible')
    expect(screen.getByText('Also moved in other products: Vendor contract (Billing) to Nov 10 - Nov 14')).toBeInTheDocument()
    // Build is on this chart, so the chart already shows its move.
    expect(screen.queryByText(/Build.*to Nov/)).not.toBeInTheDocument()
  })

  test('says nothing when only tasks on the chart moved, and clears the note on the next move', () => {
    answer({ ...task(2, 'Build', '2026-11-08', '2026-11-22'), folder_id: 1 })
    renderPane('flexible')
    expect(screen.queryByText(/Also moved/)).not.toBeInTheDocument()

    answer(vendor)
    fireEvent.click(screen.getByRole('button', { name: 'Move task-1' }))
    expect(screen.getByText(/Also moved in other products/)).toBeInTheDocument()
    answer()
    fireEvent.click(screen.getByRole('button', { name: 'Move task-1' }))
    expect(screen.queryByText(/Also moved/)).not.toBeInTheDocument()
  })
})
