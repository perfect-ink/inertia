import { Link, useLocation } from 'react-router-dom'
import { Bell, FolderKanban, Keyboard, PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react'
import { Button, classNames } from '@/components/ui'
import { isActivePath } from '@/data/project'
import { useWorkspace } from '@/api/workspace'
import { useNotifications } from '@/api/notifications'
import { SECTION_GROUPS, type Section } from './projectSections'
import { useOpenProject } from '@/hooks/useOpenProject'
import { useSidebarStore } from '@/store/sidebar'
import { projectFeatureOn } from '@/data/projectFeature'
import './SidebarRail.scss'

// Pages about the Space's projects as a whole, ahead of the open project's
// pages. Project requests is turned off (docs/features/project_intake.md).
const SPACE_SECTIONS: Section[] = [
  { label: 'Projects', path: '/space', icon: FolderKanban },
]

// The icon rail beside the sidebar panel: one button per page of the open
// project (or the whole Space), so any of them is one click away. The quick actions sit at the bottom. The middle scrolls
// when the window is too short for every button. The toggle at the bottom widens the rail to show each page's
// name beside its icon (not on a phone, where the rail shares the drawer with the panel).
export function SidebarRail({ onQuickAdd, onShortcuts }: { onQuickAdd: () => void; onShortcuts: () => void }) {
  const { pathname } = useLocation()
  const expanded = useSidebarStore((s) => s.railExpanded)
  const toggleRail = useSidebarStore((s) => s.toggleRail)
  const shared = useWorkspace().data?.shared ?? false
  const unread = useNotifications().data?.unread_count ?? 0
  const inboxActive = isActivePath(pathname, '/inbox')
  const inboxLabel = unread ? `Inbox (${unread} unread)` : 'Inbox'
  // The open project's turned-off pages are left out (a link to one still opens it).
  const project = useOpenProject()
  const groups = [SPACE_SECTIONS, ...SECTION_GROUPS.map((g) => g.sections.filter((s) => (shared || !s.sharedOnly) && (!s.feature || projectFeatureOn(project, s.feature))))]
    .filter((sections) => sections.length > 0)

  return (
    <nav aria-label="Pages" className={classNames('sidebar-rail', expanded && 'sidebar-rail--expanded')}>
      <div className="sidebar-rail_pages">
        {groups.map((sections, i) => (
          <div key={sections[0].path} role="group" className="sidebar-rail_group">
            {i > 0 && <span role="separator" className="sidebar-rail_divider" />}
            {sections.map(({ label, path, icon: Icon }) => {
              const active = isActivePath(pathname, path)
              return (
                <Link
                  key={path}
                  to={path}
                  title={expanded ? undefined : label}
                  aria-label={label}
                  aria-current={active ? 'page' : undefined}
                  className={classNames('sidebar-rail_button', active && 'sidebar-rail_button--active')}
                >
                  <Icon className="sidebar-rail_icon" />
                  {expanded && <span className="sidebar-rail_label">{label}</span>}
                </Link>
              )
            })}
          </div>
        ))}
      </div>
      <div className="sidebar-rail_group sidebar-rail_group--actions">
        <Link
          to="/inbox"
          title={expanded ? undefined : inboxLabel}
          aria-label={inboxLabel}
          aria-current={inboxActive ? 'page' : undefined}
          className={classNames('sidebar-rail_button', inboxActive && 'sidebar-rail_button--active')}
        >
          <Bell className="sidebar-rail_icon" />
          {expanded && <span className="sidebar-rail_label">Inbox</span>}
          {unread > 0 && <span className="sidebar-rail_badge" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}
        </Link>
        <Button title={expanded ? undefined : 'Quick add (⌘K)'} aria-label="Quick add" onClick={onQuickAdd} className="sidebar-rail_button">
          <Plus className="sidebar-rail_icon" />
          {expanded && <span className="sidebar-rail_label">Quick add</span>}
        </Button>
        <Button title={expanded ? undefined : 'Keyboard shortcuts (⌘/)'} aria-label="Keyboard shortcuts" onClick={onShortcuts} className="sidebar-rail_button">
          <Keyboard className="sidebar-rail_icon" />
          {expanded && <span className="sidebar-rail_label">Shortcuts</span>}
        </Button>
        <Button
          title={expanded ? undefined : 'Show page names'}
          aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-expanded={expanded}
          onClick={toggleRail}
          className="sidebar-rail_button sidebar-rail_toggle"
        >
          {expanded ? <PanelLeftClose className="sidebar-rail_icon" /> : <PanelLeftOpen className="sidebar-rail_icon" />}
          {expanded && <span className="sidebar-rail_label">Collapse</span>}
        </Button>
      </div>
    </nav>
  )
}
