import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import FileDropZone from './FileDropZone'

const mockUpload = jest.fn()
let mockProject: { id: number; name: string } | null = null
let mockFolders: object[] = []
const mockNavigate = jest.fn()
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }))
jest.mock('@/api/workspace', () => ({
  useWorkspace: () => ({ data: { root_folder_id: 1, folders: mockFolders } }),
  useUploadFiles: () => ({ mutateAsync: mockUpload }),
}))
jest.mock('@/hooks/useOpenProject', () => ({ useOpenProject: () => mockProject }))
const mockNotify = jest.fn()
jest.mock('@/store/notifications', () => ({ useNotificationStore: (select: (s: { notify: jest.Mock }) => unknown) => select({ notify: mockNotify }) }))

const file = new File(['x'], 'plan.pdf', { type: 'application/pdf' })
const transfer = { types: ['Files'], files: [file] }

beforeEach(() => { mockProject = null; mockFolders = []; mockNavigate.mockReset(); mockUpload.mockReset().mockResolvedValue([]); mockNotify.mockReset() })

test('shows a banner while files are dragged over, and hides it when they leave the window', () => {
  render(<FileDropZone />)
  expect(screen.queryByRole('status')).toBeNull()
  fireEvent.dragOver(window, { dataTransfer: transfer })
  expect(screen.getByRole('status')).toHaveTextContent('Drop files, then choose a product for them')
  fireEvent.dragLeave(window, { relatedTarget: null })
  expect(screen.queryByRole('status')).toBeNull()
})

test('uploads into the open project', async () => {
  mockProject = { id: 9, name: 'Website' }
  render(<FileDropZone />)
  fireEvent.dragOver(window, { dataTransfer: transfer })
  expect(screen.getByRole('status')).toHaveTextContent('Drop files to upload to Website')
  await act(async () => { fireEvent.drop(window, { dataTransfer: transfer }) })
  expect(mockUpload).toHaveBeenCalledWith({ folderId: 9, files: [file] })
  await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('Uploaded plan.pdf to Website'))
})

test('with no project open, asks which project and uploads there', async () => {
  mockFolders = [
    { id: 1, name: 'Root', kind: 'folder', children: [
      { id: 5, name: 'Website', kind: 'project' },
      { id: 6, name: 'App', kind: 'project' },
    ] },
  ]
  render(<FileDropZone />)
  await act(async () => { fireEvent.drop(window, { dataTransfer: transfer }) })
  expect(mockUpload).not.toHaveBeenCalled()
  expect(screen.getByRole('dialog', { name: 'Choose a product' })).toHaveTextContent('Which product should plan.pdf go into?')
  fireEvent.change(screen.getByLabelText('Product'), { target: { value: '5' } })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Upload' })) })
  expect(mockUpload).toHaveBeenCalledWith({ folderId: 5, files: [file] })
  expect(screen.queryByRole('dialog')).toBeNull()
  await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('Uploaded plan.pdf to Website'))
})

test('cancelling the project choice uploads nothing', async () => {
  mockFolders = [{ id: 5, name: 'Website', kind: 'project' }]
  render(<FileDropZone />)
  await act(async () => { fireEvent.drop(window, { dataTransfer: transfer }) })
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(mockUpload).not.toHaveBeenCalled()
})

test('a Space with no projects points to the Space home instead of uploading', async () => {
  render(<FileDropZone />)
  await act(async () => { fireEvent.drop(window, { dataTransfer: transfer }) })
  expect(screen.getByRole('dialog')).toHaveTextContent('this Space has none yet')
  fireEvent.click(screen.getByRole('button', { name: 'Go to products' }))
  expect(mockNavigate).toHaveBeenCalledWith('/space')
  expect(mockUpload).not.toHaveBeenCalled()
})

test('leaves a drag of something other than files, and a drop another handler took', async () => {
  render(<FileDropZone />)
  fireEvent.dragOver(window, { dataTransfer: { types: ['text/plain'], files: [] } })
  expect(screen.queryByRole('status')).toBeNull()
  const dropped = new Event('drop', { cancelable: true }) as Event & { dataTransfer?: unknown }
  dropped.dataTransfer = transfer
  dropped.preventDefault()
  await act(async () => { window.dispatchEvent(dropped) })
  expect(mockUpload).not.toHaveBeenCalled()
})

test('shows the error when the upload fails', async () => {
  mockProject = { id: 9, name: 'Website' }
  mockUpload.mockRejectedValue(new Error('Too large'))
  render(<FileDropZone />)
  await act(async () => { fireEvent.drop(window, { dataTransfer: transfer }) })
  await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('Unable to save. Please try again.'))
})
