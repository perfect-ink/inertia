import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUploadFiles, useWorkspace } from '@/api/workspace'
import { Button, Modal, Select } from '@/components/ui'
import { projectsOf } from '@/data/folder'
import { useOpenProject } from '@/hooks/useOpenProject'
import { useNotificationStore } from '@/store/notifications'
import { errorMessage } from '@/util/errorMessage'
import { hasFiles } from '@/util/dragFiles'
import type { Folder } from '@/types'
import './FileDropZone.scss'

function filesLabel(files: File[]): string {
  return files.length === 1 ? files[0].name : `${files.length} files`
}

// Files dropped anywhere in the workspace upload into the open project. With no project open
// (the Space home, or none chosen yet) the drop asks which project they belong to, since every
// file lives in a project. A drop that something more specific already took (a folder in the
// sidebar, the document editor) is left alone: those handlers call preventDefault first.
export default function FileDropZone() {
  const { data: workspace } = useWorkspace()
  const project = useOpenProject()
  const uploadFiles = useUploadFiles()
  const notify = useNotificationStore((s) => s.notify)
  const [dragging, setDragging] = useState(false)
  // Files dropped with no project open, waiting for the user to pick one.
  const [pending, setPending] = useState<File[] | null>(null)

  const upload = useCallback((target: Folder, files: File[]) => {
    uploadFiles.mutateAsync({ folderId: target.id, files })
      .then(() => notify(`Uploaded ${filesLabel(files)} to ${target.name}`))
      .catch((error) => notify(errorMessage(error)))
  }, [uploadFiles, notify])

  useEffect(() => {
    const over = (e: DragEvent) => {
      if (!hasFiles(e.dataTransfer)) return
      if (e.defaultPrevented) { setDragging(false); return }
      e.preventDefault()
      setDragging(true)
    }
    // Leaving the window (no element is entered) ends the drag.
    const leave = (e: DragEvent) => { if (!e.relatedTarget) setDragging(false) }
    const drop = (e: DragEvent) => {
      setDragging(false)
      if (!hasFiles(e.dataTransfer) || e.defaultPrevented) return
      e.preventDefault()
      const files = Array.from(e.dataTransfer?.files ?? [])
      if (!files.length) return
      if (project) upload(project, files)
      else setPending(files)
    }
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [project, upload])

  function uploadPending(target: Folder) {
    if (pending) upload(target, pending)
    setPending(null)
  }

  return (
    <>
      {dragging && (
        <div role="status" className="file_drop_zone">
          {project ? `Drop files to upload to ${project.name}` : 'Drop files, then choose a product for them'}
        </div>
      )}
      {pending && (
        <ChooseProjectDialog
          files={pending}
          projects={projectsOf(workspace?.folders ?? [])}
          onChoose={uploadPending}
          onClose={() => setPending(null)}
        />
      )}
    </>
  )
}

// Asks which project dropped files go into. A Space with no projects yet points to the Space
// home, where projects are made, instead of uploading them somewhere outside a project.
function ChooseProjectDialog({ files, projects, onChoose, onClose }: {
  files: File[]
  projects: Folder[]
  onChoose: (project: Folder) => void
  onClose: () => void
}) {
  const navigate = useNavigate()
  const [projectId, setProjectId] = useState(projects[0]?.id)
  const chosen = projects.find((p) => p.id === projectId)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (chosen) onChoose(chosen)
  }

  if (!projects.length) {
    return (
      <Modal open title="Choose a product" description="Files are kept in a product, and this Space has none yet. Create a product, open it, then drop the files again." onClose={onClose}>
        <div className="ui-modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" variant="primary" onClick={() => { onClose(); navigate('/space') }}>Go to products</Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open title="Choose a product" description={`Which product should ${filesLabel(files)} go into?`} onClose={onClose}>
      <form onSubmit={submit} className="ui-modal-form">
        <label className="file_drop_zone-field">
          <span>Product</span>
          <Select value={projectId ?? ''} autoFocus onChange={(e) => setProjectId(Number(e.target.value))}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </label>
        <div className="ui-modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!chosen}>Upload</Button>
        </div>
      </form>
    </Modal>
  )
}
