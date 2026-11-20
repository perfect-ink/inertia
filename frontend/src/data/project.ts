// Where a new document goes when no project is open and no folder was chosen.
// Projects are "products" to users; Spaces made before that have a "Personal
// Project", which is still used (backend LooseDocuments keeps the same list).
export const PERSONAL_PROJECT_NAME = 'Personal Product'
export const PERSONAL_PROJECT_NAMES = [PERSONAL_PROJECT_NAME, 'Personal Project']

// Icons a project can show, by name (stored in `folders.icon`). Monochrome
// line icons only: emojis are never used as icons (design principle 13).
export const PROJECT_ICONS = [
  { name: 'rocket', label: 'Rocket' },
  { name: 'folder', label: 'Folder' },
  { name: 'pin', label: 'Pin' },
  { name: 'target', label: 'Target' },
  { name: 'lightbulb', label: 'Light bulb' },
  { name: 'wrench', label: 'Wrench' },
  { name: 'trending-up', label: 'Chart' },
  { name: 'flask', label: 'Flask' },
  { name: 'palette', label: 'Palette' },
  { name: 'music', label: 'Music' },
  { name: 'book', label: 'Book' },
  { name: 'house', label: 'House' },
  { name: 'sprout', label: 'Sprout' },
  { name: 'star', label: 'Star' },
  { name: 'flame', label: 'Flame' },
  { name: 'message', label: 'Message' },
  { name: 'compass', label: 'Compass' },
  { name: 'package', label: 'Package' },
  { name: 'calendar', label: 'Calendar' },
  { name: 'check', label: 'Check' },
  { name: 'bug', label: 'Bug' },
  { name: 'lock', label: 'Lock' },
  { name: 'globe', label: 'Globe' },
  { name: 'briefcase', label: 'Briefcase' },
] as const

export type ProjectIconName = (typeof PROJECT_ICONS)[number]['name']

// Projects that chose an emoji before icons replaced them show the matching icon.
const LEGACY_EMOJIS: Record<string, ProjectIconName> = {
  '🚀': 'rocket', '📁': 'folder', '📌': 'pin', '🎯': 'target', '💡': 'lightbulb', '🛠️': 'wrench', '🛠': 'wrench', '📈': 'trending-up',
  '🧪': 'flask', '🎨': 'palette', '🎵': 'music', '📚': 'book', '🏠': 'house', '🌱': 'sprout', '⭐': 'star', '🔥': 'flame',
  '💬': 'message', '🧭': 'compass', '📦': 'package', '🗓️': 'calendar', '🗓': 'calendar', '✅': 'check', '🐞': 'bug', '🔒': 'lock',
  '🌍': 'globe', '💼': 'briefcase',
}

// What a project shows as its icon: an uploaded image wins over a named icon;
// neither (or an emoji with no matching icon) means the default project icon.
export type ProjectIconKind = { image: string } | { icon: ProjectIconName } | null

export function projectIconOf(project: { icon?: string | null; image_url?: string | null }): ProjectIconKind {
  if (project.image_url) return { image: project.image_url }
  const value = project.icon?.trim() ?? ''
  const named = PROJECT_ICONS.find((i) => i.name === value)?.name ?? LEGACY_EMOJIS[value]
  return named ? { icon: named } : null
}

// Whether the page at `pathname` is the one a navigation link opens. A link
// may carry a query (`/tasks?view=backlog`), which doesn't change the page.
export function isActivePath(pathname: string, link: string): boolean {
  return pathname === link.split('?')[0]
}
import type { ProjectStatus } from '@/types'

export const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'done', label: 'Done' },
]

export function projectStatusLabel(status: ProjectStatus | undefined): string {
  return PROJECT_STATUSES.find((s) => s.value === (status ?? 'planned'))?.label ?? 'Planned'
}

export type PortfolioSortKey = 'name' | 'owner' | 'status' | 'target_date' | 'percent'

// The sortable columns of the portfolio table, in order.
export const PORTFOLIO_COLUMNS: { key: PortfolioSortKey; label: string }[] = [
  { key: 'name', label: 'Product' },
  { key: 'owner', label: 'Owner' },
  { key: 'status', label: 'Status' },
  { key: 'target_date', label: 'Dates' },
  { key: 'percent', label: 'Progress' },
]

// Portfolio rows ordered by a column, ascending or descending; empty owners and
// dates sort last. A copy: the input is not changed.
export function sortPortfolio<T extends { name: string; owner_name: string | null; project_status: ProjectStatus; target_date: string | null; percent: number }>(
  rows: T[], key: PortfolioSortKey, dir: 'asc' | 'desc',
): T[] {
  const factor = dir === 'asc' ? 1 : -1
  const order = PROJECT_STATUSES.map((s) => s.value)
  return [...rows].sort((a, b) => {
    switch (key) {
      case 'name': return a.name.localeCompare(b.name) * factor
      case 'percent': return (a.percent - b.percent) * factor
      case 'status': return (order.indexOf(a.project_status) - order.indexOf(b.project_status)) * factor || a.name.localeCompare(b.name)
      case 'owner':
        if (!a.owner_name || !b.owner_name) return a.owner_name === b.owner_name ? a.name.localeCompare(b.name) : a.owner_name ? -1 : 1
        return a.owner_name.localeCompare(b.owner_name) * factor || a.name.localeCompare(b.name)
      case 'target_date':
        if (!a.target_date || !b.target_date) return a.target_date === b.target_date ? a.name.localeCompare(b.name) : a.target_date ? -1 : 1
        return a.target_date.localeCompare(b.target_date) * factor || a.name.localeCompare(b.name)
    }
  })
}

// The projects the primary sidebar lists: the ones opened most recently, then
// the rest in their usual order, up to `limit`. Ids of projects that no longer
// exist (or are in another Space) are skipped.
export function recentProjects<T extends { id: number }>(projects: T[], recentIds: number[], limit = 5): T[] {
  const byId = new Map(projects.map((p) => [p.id, p]))
  const recent = recentIds.map((id) => byId.get(id)).filter((p): p is T => !!p)
  const rest = projects.filter((p) => !recentIds.includes(p.id))
  return [...recent, ...rest].slice(0, limit)
}
