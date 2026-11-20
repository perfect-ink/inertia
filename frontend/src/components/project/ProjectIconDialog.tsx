import { useRef, useState } from 'react'
import { ImagePlus } from 'lucide-react'
import { Button, FormError, Input, Modal, classNames } from '@/components/ui'
import { useUpdateFolder } from '@/api/folders'
import { uploadFile } from '@/api/uploads'
import { errorMessage } from '@/util/errorMessage'
import { PROJECT_ICONS, projectIconOf } from '@/data/project'
import type { Folder } from '@/types'
import ProjectIcon from './ProjectIcon'
import { PROJECT_ICON_COMPONENTS } from './projectIcons'
import './ProjectIconDialog.scss'

// Choose a project's icon, upload an image for it, or clear both.
export default function ProjectIconDialog({ project, onClose }: { project: Folder | null; onClose: () => void }) {
  const updateFolder = useUpdateFolder()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const current = project ? projectIconOf(project) : null
  const chosen = current && 'icon' in current ? current.icon : null

  function save(changes: { icon?: string | null; image_url?: string | null }) {
    if (!project) return
    setError('')
    updateFolder.mutate({ id: project.id, ...changes }, { onSuccess: onClose, onError: (e) => setError(errorMessage(e)) })
  }

  async function upload(file: File | undefined) {
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const { url } = await uploadFile(file)
      save({ image_url: url })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setUploading(false)
    }
  }

  return (
    <Modal open={project !== null} title={`Icon for ${project?.name ?? 'product'}`} onClose={onClose}>
      {project && (
        <div className="ui-project_icon_dialog">
          {project.image_url && (
            <div className="ui-project_icon_dialog-current">
              <ProjectIcon project={project} size="lg" />
              <span>Image</span>
            </div>
          )}

          <div className="ui-project_icon_dialog-icons" role="group" aria-label="Icons">
            {PROJECT_ICONS.map(({ name, label }) => {
              const Glyph = PROJECT_ICON_COMPONENTS[name]
              return (
                <Button
                  key={name}
                  aria-label={label}
                  title={label}
                  aria-pressed={chosen === name}
                  onClick={() => save({ icon: name, image_url: null })}
                  className={classNames('ui-project_icon_dialog-icon', chosen === name && 'ui-project_icon_dialog-icon--active')}
                >
                  <Glyph aria-hidden="true" className="ui-project_icon_dialog-glyph" />
                </Button>
              )
            })}
          </div>

          <FormError message={error} />

          <div className="ui-project_icon_dialog-actions">
            <Input
              ref={fileRef}
              type="file"
              accept="image/*"
              aria-label="Choose an image"
              hidden
              onChange={(e) => { upload(e.target.files?.[0]); e.target.value = '' }}
            />
            <Button variant="secondary" disabled={uploading} onClick={() => fileRef.current?.click()} className="ui-project_icon_dialog-upload">
              <ImagePlus aria-hidden="true" className="ui-project_icon_dialog-button_icon" />
              {uploading ? 'Uploading…' : 'Upload image'}
            </Button>
            {(project.icon || project.image_url) && (
              <Button onClick={() => save({ icon: null, image_url: null })}>Remove icon</Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
