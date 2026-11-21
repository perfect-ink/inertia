import { FolderKanban } from 'lucide-react'
import { classNames } from '@/components/ui'
import { projectIconOf } from '@/data/project'
import type { Folder } from '@/types'
import { PROJECT_ICON_COMPONENTS } from './projectIcons'
import './ProjectIcon.scss'

// A product's image, icon, emoji or the default product icon, in a square box.
export default function ProjectIcon({ project, size = 'sm', className }: {
  project: Pick<Folder, 'icon' | 'image_url'>
  size?: 'sm' | 'lg'
  className?: string
}) {
  const icon = projectIconOf(project)
  const Glyph = icon && 'icon' in icon ? PROJECT_ICON_COMPONENTS[icon.icon] : FolderKanban
  return (
    <span className={classNames('ui-project_icon', `ui-project_icon--${size}`, className)} aria-hidden="true">
      {icon && 'image' in icon
        ? <img src={icon.image} alt="" className="ui-project_icon-image" />
        : icon && 'emoji' in icon
        ? <span className="ui-project_icon-emoji">{icon.emoji}</span>
        : <Glyph className="ui-project_icon-glyph" />}
    </span>
  )
}
