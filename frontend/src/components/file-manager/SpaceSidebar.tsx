import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Bell, ChevronsUpDown, PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react'
import { FormError, IconButton, Menu, PromptDialog, classNames, type MenuItem } from '@/components/ui'
import ProjectIcon from '@/components/project/ProjectIcon'
import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher'
import { useWorkspace } from '@/api/workspace'
import { useCreateFolder } from '@/api/folders'
import { useNotifications } from '@/api/notifications'
import { folderOfDocument, flattenFolders, projectOf, projectsOf } from '@/data/folder'
import { isActivePath, recentProjects } from '@/data/project'
import { itemAtPath } from '@/data/path'
import { usePaths } from '@/hooks/usePaths'
import { useSelectProject } from '@/hooks/useSelectProject'
import { useOpenProject } from '@/hooks/useOpenProject'
import { useProjectStore } from '@/store/projects'
import { useSidebarStore } from '@/store/sidebar'
import { useAuthStore } from '@/store/auth'
import { errorMessage } from '@/util/errorMessage'
import { isElectron } from '@/util/platform'
import logoMark from '@/assets/logo-mark.svg'
import './SpaceSidebar.scss'

// The primary sidebar, far left: the Space switcher at the top, the projects
// opened most recently below it, and the signed-in person at the bottom.
// Collapsed it is a column of icons (logo, project icons, avatar). On a phone,
// with a project open, it shares the drawer with the project sidebar and stays
// that narrow; with none open it shows names.
export function SpaceSidebar({ accountItems }: { accountItems: MenuItem[] }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const paths = usePaths()
  const { data: workspace } = useWorkspace()
  const createFolder = useCreateFolder()
  const selectProject = useSelectProject()
  const { user } = useAuthStore()
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const recentIds = useProjectStore((s) => s.recentIds)
  const openProject = useOpenProject()
  const collapsed = useSidebarStore((s) => s.collapsed)
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed)
  const unread = useNotifications().data?.unread_count ?? 0
  const [naming, setNaming] = useState(false)
  const [error, setError] = useState('')
  const projects = projectsOf(workspace?.folders ?? [])
  const recent = recentProjects(projects, recentIds)
  const pinned = flattenFolders(workspace?.folders ?? []).flatMap((f) => f.documents ?? []).filter((d) => d.pinned)
  // Names show beside icons only when there's room; the title then repeats them as a tooltip.
  const tip = (label: string) => (collapsed ? label : undefined)

  // Opening a folder or document inside a project opens that project too.
  useEffect(() => {
    const tree = workspace?.folders ?? []
    const item = itemAtPath(tree, pathname)
    const folderId = item?.type === 'folder' ? item.id : item ? folderOfDocument(tree, item.id)?.id : undefined
    const project = folderId ? projectOf(tree, folderId) : null
    if (project) selectProject(project.id)
  }, [pathname, workspace, selectProject])

  // A project that was archived, deleted or moved away can't stay open.
  useEffect(() => {
    if (workspace && activeProjectId && !projectsOf(workspace.folders).some((p) => p.id === activeProjectId)) selectProject(null)
  }, [workspace, activeProjectId, selectProject])

  async function addProject(name: string) {
    setNaming(false)
    if (!name) return
    setError('')
    try {
      const project = await createFolder.mutateAsync({ name, kind: 'project' })
      selectProject(project.id)
      navigate(paths.folder(project.id))
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'
  const inboxLabel = unread ? `Inbox (${unread} unread)` : 'Inbox'
  const inboxActive = isActivePath(pathname, '/inbox')

  return (
    <nav
      aria-label="Space"
      className={classNames('ui-space_sidebar', collapsed && 'ui-space_sidebar--collapsed', openProject && 'ui-space_sidebar--beside_project')}
    >
      <div className={classNames('space_sidebar-header', 'sidebar-drag', isElectron && 'space_sidebar-header--electron')}>
        <WorkspaceSwitcher>
          <img src={logoMark} alt="" className="space_sidebar-logo" />
        </WorkspaceSwitcher>
        <IconButton
          fill
          label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          onClick={toggleCollapsed}
          className="space_sidebar-toggle"
        >
          {collapsed ? <PanelLeftOpen className="space_sidebar-icon" /> : <PanelLeftClose className="space_sidebar-icon" />}
        </IconButton>
      </div>

      <div className="space_sidebar-body">
        <div className="space_sidebar-heading">
          <Link to="/space" aria-current={pathname === '/space' ? 'page' : undefined} title={tip('All products')} className="space_sidebar-label">Products</Link>
          <IconButton fill label="New product" title="New product" onClick={() => setNaming(true)} className="space_sidebar-add">
            <Plus className="space_sidebar-icon" />
          </IconButton>
        </div>
        <FormError message={error} />
        <ul aria-label="Products" className="space_sidebar-list">
          {recent.map((project) => {
            const active = project.id === openProject?.id
            return (
              <li key={project.id}>
                <Link
                  to={paths.folder(project.id)}
                  onClick={() => selectProject(project.id)}
                  aria-current={active ? 'true' : undefined}
                  title={tip(project.name)}
                  className={classNames('space_sidebar-row', active && 'space_sidebar-row--active')}
                >
                  <ProjectIcon project={project} />
                  <span className="space_sidebar-name">{project.name}</span>
                </Link>
              </li>
            )
          })}
        </ul>
        {projects.length > recent.length && (
          <Link to="/space" className="space_sidebar-more">All products</Link>
        )}

        {/* Pinned documents, only when there are some. */}
        {pinned.length > 0 && (
          <>
            <span className="space_sidebar-label space_sidebar-label--static">Pinned</span>
            <ul aria-label="Pinned" className="space_sidebar-list space_sidebar-list--pinned">
              {pinned.map((doc) => {
                const to = paths.document(doc)
                return (
                  <li key={doc.id}>
                    <Link to={to} aria-current={pathname === to ? 'page' : undefined} className={classNames('space_sidebar-row', pathname === to && 'space_sidebar-row--active')}>
                      <span className="space_sidebar-name">{doc.title}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>

      <div className="space_sidebar-footer">
        <Link
          to="/inbox"
          aria-label={inboxLabel}
          title={tip(inboxLabel)}
          aria-current={inboxActive ? 'page' : undefined}
          className={classNames('space_sidebar-row', inboxActive && 'space_sidebar-row--active')}
        >
          <span className="space_sidebar-glyph">
            <Bell className="space_sidebar-icon" />
            {unread > 0 && <span className="space_sidebar-badge" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}
          </span>
          <span className="space_sidebar-name">Inbox</span>
        </Link>
        <Menu above label={`Account: ${user?.name ?? 'not signed in'}`} triggerClassName="space_sidebar-user" items={accountItems}>
          <span className="space_sidebar-avatar" aria-hidden="true">{initials}</span>
          <span className="space_sidebar-name">{user?.name ?? 'Not signed in'}</span>
          <ChevronsUpDown className="space_sidebar-icon space_sidebar-chevron" aria-hidden="true" />
        </Menu>
      </div>

      <PromptDialog open={naming} title="New product" label="Product name" placeholder="e.g. Website relaunch" submitLabel="Create" onSubmit={addProject} onClose={() => setNaming(false)} />
    </nav>
  )
}
