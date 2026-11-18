import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import FileDropZone from './FileDropZone'

const mockUpload = jest.fn()
let mockProject: { id: number; name: string } | null = null
jest.mock('@/api/workspace', () => ({
  useWorkspace: () => ({ data: { root_folder_id: 1, folders: [] } }),
  useUploadFiles: () => ({ mutateAsync: mockUpload }),
}))
jest.mock('@/hooks/useOpenProject', () => ({ useOpenProject: () => mockProject }))
const mockNotify = jest.fn()
jest.mock('@/store/notifications', () => ({ useNotificationStore: (select: (s: { notify: jest.Mock }) => unknown) => select({ notify: mockNotify }) }))

const file = new File(['x'], 'plan.pdf', { type: 'application/pdf' })
const transfer = { types: ['Files'], files: [file] }

beforeEach(() => { mockProject = null; mockUpload.mockReset().mockResolvedValue([]); mockNotify.mockReset() })

test('shows a banner while files are dragged over, and hides it when they leave the window', () => {
  render(<FileDropZone />)
  expect(screen.queryByRole('status')).toBeNull()
  fireEvent.dragOver(window, { dataTransfer: transfer })
  expect(screen.getByRole('status')).toHaveTextContent('Drop files to upload to this Space')
  fireEvent.dragLeave(window, { relatedTarget: null })
  expect(screen.queryByRole('status')).toBeNull()
})

test('uploads a drop into the Space root, or the open project', async () => {
  render(<FileDropZone />)
  await act(async () => { fireEvent.drop(window, { dataTransfer: transfer }) })
  expect(mockUpload).toHaveBeenCalledWith({ folderId: 1, files: [file] })
  await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('Uploaded plan.pdf to this Space'))
})

test('uploads into the open project', async () => {
  mockProject = { id: 9, name: 'Website' }
  render(<FileDropZone />)
  await act(async () => { fireEvent.drop(window, { dataTransfer: transfer }) })
  expect(mockUpload).toHaveBeenCalledWith({ folderId: 9, files: [file] })
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
  mockUpload.mockRejectedValue(new Error('Too large'))
  render(<FileDropZone />)
  await act(async () => { fireEvent.drop(window, { dataTransfer: transfer }) })
  await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('Unable to save. Please try again.'))
})
