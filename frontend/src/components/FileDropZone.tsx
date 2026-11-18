import { useEffect, useState } from 'react'
import { useUploadFiles, useWorkspace } from '@/api/workspace'
import { useOpenProject } from '@/hooks/useOpenProject'
import { useNotificationStore } from '@/store/notifications'
import { errorMessage } from '@/util/errorMessage'
import { hasFiles } from '@/util/dragFiles'
import './FileDropZone.scss'

// Files dropped anywhere in the workspace upload into the open project, or the Space's root
// folder when none is open. A drop that something more specific already took (a folder in the
// sidebar, the document editor) is left alone: those handlers call preventDefault first.
export default function FileDropZone() {
  const { data: workspace } = useWorkspace()
  const project = useOpenProject()
  const uploadFiles = useUploadFiles()
  const notify = useNotificationStore((s) => s.notify)
  const [dragging, setDragging] = useState(false)
  const target = project?.id ?? workspace?.root_folder_id ?? workspace?.folders?.[0]?.id
  const targetName = project?.name ?? 'this Space'

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
      if (!files.length || !target) return
      uploadFiles.mutateAsync({ folderId: target, files })
        .then(() => notify(`Uploaded ${files.length === 1 ? files[0].name : `${files.length} files`} to ${targetName}`))
        .catch((error) => notify(errorMessage(error)))
    }
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [target, targetName, uploadFiles, notify])

  if (!dragging) return null
  return <div role="status" className="file_drop_zone">Drop files to upload to {targetName}</div>
}
