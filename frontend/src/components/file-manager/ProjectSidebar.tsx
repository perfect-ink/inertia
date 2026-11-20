import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ChevronRight, ChevronsUpDown, Plus } from 'lucide-react'
import { Button, FormError, Input, Menu, PromptDialog, classNames } from '@/components/ui'
import ProjectIcon from '@/components/project/ProjectIcon'
import ProjectIconDialog from '@/components/project/ProjectIconDialog'
import ProjectFeaturesDialog from '@/components/project/ProjectFeaturesDialog'
import { useWorkspace } from '@/api/workspace'
import { useCreateFolder } from '@/api/folders'
import { canWriteWorkspace } from '@/api/workspaces'
import { errorMessage } from '@/util/errorMessage'
import { shortcutLabel } from '@/util/shortcuts'
import { documentsIn, projectsOf } from '@/data/folder'
import { isActivePath } from '@/data/project'
import { projectFeatureOn } from '@/data/projectFeature'
import { usePaths } from '@/hooks/usePaths'
import { useSelectProject } from '@/hooks/useSelectProject'
import { useNewDocument } from '@/hooks/useNewDocument'
import { useSidebarStore } from '@/store/sidebar'
import type { Document, Folder } from '@/types'
import { TASKS_SECTION, VIEW_SECTIONS } from './projectSections'
import { FolderItem } from './FolderItem'
import './ProjectSidebar.scss'

// The secondary sidebar: the open project's tasks and documents, with its other
// pages (sprints, OKRs, roadmap...) as a plain list at the bottom. Shown only
// while a project is open; the primary sidebar (SpaceSidebar) picks the project.
export function ProjectSidebar({ project }: { project: Folder }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const paths = usePaths()
  const { data: workspace } = useWorkspace()
  const createFolder = useCreateFolder()
  const selectProject = useSelectProject()
  const newDocument = useNewDocument()
  const viewsOpen = useSidebarStore((s) => s.viewsOpen)
  const toggleViews = useSidebarStore((s) => s.toggleViews)
  const [naming, setNaming] = useState(false)
  const [addingFolder, setAddingFolder] = useState(false)
  const [iconOpen, setIconOpen] = useState(false)
  const [featuresOpen, setFeaturesOpen] = useState(false)
  const [error, setError] = useState('')
  const canWrite = canWriteWorkspace(workspace?.role)
  const shared = workspace?.shared ?? false
  const projects = projectsOf(workspace?.folders ?? [])
  const shown = (s: { feature?: Parameters<typeof projectFeatureOn>[1]; sharedOnly?: boolean }) =>
    (shared || !s.sharedOnly) && (!s.feature || projectFeatureOn(project, s.feature))
  const tasksOn = shown(TASKS_SECTION)
  const views = VIEW_SECTIONS.filter(shown)
  // The current page is always visible, even with the list closed.
  const currentView = views.find((v) => isActivePath(pathname, v.path))
  const listedViews = viewsOpen ? views : currentView ? [currentView] : []

  function open(target: Folder) {
    selectProject(target.id)
    navigate(paths.folder(target.id))
  }

  async function addProject(name: string) {
    setNaming(false)
    if (!name) return
    setError('')
    try {
      open(await createFolder.mutateAsync({ name, kind: 'project' }))
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  async function createIn(type: Document['doc_type']) {
    setError('')
    try {
      await newDocument(type, project.id)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  function addFolder(name: string) {
    setAddingFolder(false)
    if (!name) return
    setError('')
    createFolder.mutate({ name, parent_id: project.id }, { onError: (e) => setError(errorMessage(e)) })
  }

  const row = (label: string, path: string) => {
    const active = isActivePath(pathname, path)
    return (
      <Link key={path} to={path} aria-current={active ? 'page' : undefined} className={classNames('project_sidebar-row', active && 'project_sidebar-row--active')}>
        {label}
      </Link>
    )
  }

  return (
    <aside aria-label={`Product: ${project.name}`} className="ui-project_sidebar">
      {/* The project's name opens its menu: switch project, its overview, start one, its icon and pages. */}
      <div className="project_sidebar-header sidebar-drag">
        <Menu
          label={`Product: ${project.name}. Switch product`}
          triggerClassName="workspace_switcher-trigger"
          items={[
            ...projects.map((p) => ({
              key: `project-${p.id}`,
              label: p.name,
              icon: <ProjectIcon project={p} />,
              checked: p.id === project.id,
              onSelect: () => open(p),
            })),
            { key: 'overview', label: 'Overview', separatorBefore: true, onSelect: () => navigate(paths.folder(project.id)) },
            { key: 'new', label: 'New product...', onSelect: () => setNaming(true) },
            { key: 'icon', label: 'Change icon...', onSelect: () => setIconOpen(true) },
            ...(canWrite ? [{ key: 'features', label: 'Choose pages...', onSelect: () => setFeaturesOpen(true) }] : []),
            { key: 'all', label: 'All products', onSelect: () => navigate('/space') },
          ]}
        >
          <ProjectIcon project={project} />
          <span className="workspace_switcher-text">
            <span className="workspace_switcher-name">{project.name}</span>
          </span>
          <ChevronsUpDown className="workspace_switcher-icon" aria-hidden="true" />
        </Menu>
      </div>

      <div className="project_sidebar-body">
        {tasksOn && <nav aria-label="Tasks" className="project_sidebar-section">{row('Tasks', TASKS_SECTION.path)}</nav>}

        {/* Documents, sheets, Collections, folders and files, subfolders included. */}
        <div className="project_sidebar-section project_sidebar-section--grow">
          <div className="project_sidebar-heading">
            <Link to="/documents" aria-current={pathname === '/documents' ? 'page' : undefined} className="project_sidebar-label">Documents</Link>
            <Menu
              label="New"
              triggerClassName="project_sidebar-add"
              items={[
                { key: 'document', label: 'Document', hint: shortcutLabel('⌘N'), onSelect: () => createIn('document') },
                { key: 'sheet', label: 'Sheet', hint: shortcutLabel('⌘⇧N'), onSelect: () => createIn('spreadsheet') },
                { key: 'collection', label: 'Collection', onSelect: () => createIn('table') },
                { key: 'folder', label: 'Folder', onSelect: () => setAddingFolder(true) },
              ]}
            >
              <Plus className="project_sidebar-icon" />
            </Menu>
          </div>
          <FormError message={error} />
          {addingFolder && (
            <div className="project_sidebar-new">
              <Input
                autoFocus
                aria-label="Folder name"
                placeholder="Folder name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addFolder(e.currentTarget.value.trim())
                  if (e.key === 'Escape') setAddingFolder(false)
                }}
                onBlur={(e) => addFolder(e.currentTarget.value.trim())}
              />
            </div>
          )}
          {documentsIn(project).length === 0 && !project.children?.length
            ? <p className="project_sidebar-note">No documents yet.</p>
            : <FolderItem folder={project} bare />}
        </div>

        {/* Everything else the project shows, at the bottom: plain names, folded away by default. */}
        {views.length > 0 && (
          <nav aria-label="Views" className="project_sidebar-section project_sidebar-section--views">
            <Button aria-expanded={viewsOpen} onClick={toggleViews} className="project_sidebar-label project_sidebar-toggle">
              <ChevronRight className={classNames('project_sidebar-chevron', viewsOpen && 'project_sidebar-chevron--open')} aria-hidden="true" />
              Views
            </Button>
            {listedViews.map((v) => row(v.label, v.path))}
          </nav>
        )}
      </div>

      <PromptDialog open={naming} title="New product" label="Product name" placeholder="e.g. Website relaunch" submitLabel="Create" onSubmit={addProject} onClose={() => setNaming(false)} />
      <ProjectIconDialog project={iconOpen ? project : null} onClose={() => setIconOpen(false)} />
      <ProjectFeaturesDialog project={featuresOpen ? project : null} onClose={() => setFeaturesOpen(false)} />
    </aside>
  )
}
