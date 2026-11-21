import { useRef, useState } from 'react'
import { ImagePlus } from 'lucide-react'
import { Button, FormError, Input, Modal, Tab, Tabs, classNames } from '@/components/ui'
import { useUpdateFolder } from '@/api/folders'
import { uploadFile } from '@/api/uploads'
import { errorMessage } from '@/util/errorMessage'
import { PROJECT_EMOJIS, PROJECT_ICONS, projectIconOf } from '@/data/project'
import type { Folder } from '@/types'
import ProjectIcon from './ProjectIcon'
import { PROJECT_ICON_COMPONENTS } from './projectIcons'
import './ProjectIconDialog.scss'

// Choose a product's icon: a line icon, an emoji or an uploaded image, or
// clear it for the default.
export default function ProjectIconDialog({ project, onClose }: { project: Folder | null; onClose: () => void }) {
  const updateFolder = useUpdateFolder()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const current = project ? projectIconOf(project) : null
  const chosen = current && 'icon' in current ? current.icon : null
  const chosenEmoji = current && 'emoji' in current ? current.emoji : null
  // The tab opens on the kind the product has now; null until the person picks one.
  const [kind, setKind] = useState<'icon' | 'emoji' | 'image' | null>(null)
  const shownKind = kind ?? (current && 'emoji' in current ? 'emoji' : current && 'image' in current ? 'image' : 'icon')

  function close() {
    setKind(null)
    onClose()
  }

  function save(changes: { icon?: string | null; image_url?: string | null }) {
    if (!project) return
    setError('')
    updateFolder.mutate({ id: project.id, ...changes }, { onSuccess: close, onError: (e) => setError(errorMessage(e)) })
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
    <Modal open={project !== null} title={`Icon for ${project?.name ?? 'product'}`} onClose={close}>
      {project && (
        <div className="ui-project_icon_dialog">
          <Tabs label="Icon type" variant="segmented">
            <Tab active={shownKind === 'icon'} onClick={() => setKind('icon')}>Icon</Tab>
            <Tab active={shownKind === 'emoji'} onClick={() => setKind('emoji')}>Emoji</Tab>
            <Tab active={shownKind === 'image'} onClick={() => setKind('image')}>Image</Tab>
          </Tabs>

          {shownKind === 'icon' && (
            <div className="ui-project_icon_dialog-grid" role="group" aria-label="Icons">
              {PROJECT_ICONS.map(({ name, label }) => {
                const Glyph = PROJECT_ICON_COMPONENTS[name]
                return (
                  <Button
                    key={name}
                    aria-label={label}
                    title={label}
                    aria-pressed={chosen === name}
                    onClick={() => save({ icon: name, image_url: null })}
                    className={classNames('ui-project_icon_dialog-choice', chosen === name && 'ui-project_icon_dialog-choice--active')}
                  >
                    <Glyph aria-hidden="true" className="ui-project_icon_dialog-glyph" />
                  </Button>
                )
              })}
            </div>
          )}

          {shownKind === 'emoji' && (
            <>
              <div className="ui-project_icon_dialog-grid" role="group" aria-label="Emojis">
                {PROJECT_EMOJIS.map((emoji) => (
                  <Button
                    key={emoji}
                    aria-label={emoji}
                    aria-pressed={chosenEmoji === emoji}
                    onClick={() => save({ icon: emoji, image_url: null })}
                    className={classNames('ui-project_icon_dialog-choice', 'ui-project_icon_dialog-emoji', chosenEmoji === emoji && 'ui-project_icon_dialog-choice--active')}
                  >
                    {emoji}
                  </Button>
                ))}
              </div>
              <label className="ui-project_icon_dialog-field">
                Or type any emoji
                <Input
                  maxLength={16}
                  onKeyDown={(e) => {
                    const value = e.currentTarget.value.trim()
                    if (e.key === 'Enter' && value) save({ icon: value, image_url: null })
                  }}
                />
              </label>
            </>
          )}

          {shownKind === 'image' && (
            <div className="ui-project_icon_dialog-current">
              {project.image_url && <ProjectIcon project={project} size="lg" />}
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
                {uploading ? 'Uploading…' : project.image_url ? 'Replace image' : 'Upload image'}
              </Button>
            </div>
          )}

          <FormError message={error} />

          <div className="ui-project_icon_dialog-actions">
            {(project.icon || project.image_url) && (
              <Button onClick={() => save({ icon: null, image_url: null })}>Remove icon</Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
