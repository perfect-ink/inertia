import { format, parseISO } from 'date-fns'
import type { Folder, Task, TaskDependency, TaskLink } from '@/types'
import { DEPENDENCY_LABEL, externalEnd, linkDaysLate, linkSides, spanOf, type BarSide } from './dependency'
import { projectOf } from './folder'
import { taskFolderId } from './task'

// Links between tasks in different projects: how the Gantt draws them as stubs
// on a bar, how the browser reports the tasks a move shifted in other projects,
// and the Space-wide list on the Portfolio.

// "1 day" / "N days", for how far a link's dates are off.
const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`

// The note on a link whose dates no longer hold.
export const brokenNote = (brokenByDays: number) => `Dates break this link by ${days(brokenByDays)}`

const shortDate = (value: string) => format(parseISO(value), 'MMM d')

// `Title (Project)`, or just the title when the task is in no project.
const nameWithProject = (title: string, project: string | null) => (project ? `${title} (${project})` : title)

// ---- Stubs on the Gantt ----------------------------------------------------

export type StubDirection = 'in' | 'out'

// A link to a task in another project, as it leaves or enters the bar of the
// task on the chart: `out` when the task on the chart is waited on, `in` when it waits.
export interface LinkStub {
  key: string
  // The chart row it attaches to (`task-<id>`).
  row: string
  side: BarSide
  direction: StubDirection
  // What the other task is called, with its project.
  name: string
  // The full note for the tooltip: link type, the other task's due date, any broken dates.
  detail: string
  brokenByDays: number
  // On the driving path: the task on the chart is driven by it, or drives it.
  critical: boolean
}

const STUB_PREFIX: Record<StubDirection, string> = { in: 'Waits on', out: 'Needed by' }

// One stub for each link with exactly one end on the chart (`external`, from
// `splitDependencies`). `onChart` is the chart's tasks by id and `critical` the
// ids on the driving path.
export function linkStubs(external: TaskDependency[], onChart: Map<number, { start_date?: string | null; due_date: string | null }>, folders: Folder[], critical: Set<number>): LinkStub[] {
  return external.map((dependency) => {
    const end = externalEnd(dependency, onChart, folders)
    const ownId = end.isPredecessor ? dependency.successor_id : dependency.predecessor_id
    const otherId = end.isPredecessor ? dependency.predecessor_id : dependency.successor_id
    const direction: StubDirection = end.isPredecessor ? 'in' : 'out'
    const sides = linkSides(dependency.kind)
    const name = nameWithProject(end.task?.title ?? `Task #${otherId}`, end.project)
    const due = end.task?.due_date
    const detail = [
      `${STUB_PREFIX[direction]} ${name}`,
      DEPENDENCY_LABEL[dependency.kind],
      due ? `due ${shortDate(due)}` : null,
      end.brokenByDays > 0 ? brokenNote(end.brokenByDays) : null,
    ].filter(Boolean).join(' · ')
    return {
      key: String(dependency.id),
      row: `task-${ownId}`,
      side: direction === 'in' ? sides.to : sides.from,
      direction,
      name,
      detail,
      brokenByDays: end.brokenByDays,
      critical: critical.has(ownId) && critical.has(otherId),
    }
  })
}

// A stub placed on the chart: where it starts and how it is built.
export interface PlacedStub {
  key: string
  // Where the bar's edge is, as a percentage along the track, and the row's vertical centre in rem.
  leftPct: number
  topRem: number
  side: BarSide
  direction: StubDirection
  // Which way the arrowhead points, and whether it sits against the bar (an
  // arrow that enters) or at the far end (one that leaves).
  headRight: boolean
  headFirst: boolean
  // Track left between the bar's edge and the chart's edge in the stub's direction, as a percentage.
  roomPct: number
  label: string
  detail: string
  brokenByDays: number
  critical: boolean
}

// Space between the two stubs of a side that has both an entering and a leaving link.
const NUDGE_REM = 0.4

// Where each stub goes. `bars` are the chart's rows in order (`key` as in
// `Scheduled.key`, offsets and widths as percentages of the track) and the
// pitch and height are the row geometry in rem. Stubs for a row that is not
// drawn are dropped; several links on the same side of a bar share one stub
// (a stub per link would draw on top of each other), named together.
export function placeStubs(stubs: LinkStub[], bars: { key: string; offsetPct: number; widthPct: number }[], pitchRem: number, heightRem: number): PlacedStub[] {
  const rowOf = new Map(bars.map((bar, i) => [bar.key, i]))
  const groups = new Map<string, LinkStub[]>()
  stubs.forEach((stub) => {
    if (!rowOf.has(stub.row)) return
    const id = `${stub.row}|${stub.side}|${stub.direction}`
    groups.set(id, [...(groups.get(id) ?? []), stub])
  })
  const bothWays = (row: string, side: BarSide) => groups.has(`${row}|${side}|in`) && groups.has(`${row}|${side}|out`)

  return [...groups.values()].map((group) => {
    const { row, side, direction } = group[0]
    const index = rowOf.get(row) as number
    const bar = bars[index]
    const edge = bar.offsetPct + (side === 'end' ? bar.widthPct : 0)
    const nudge = bothWays(row, side) ? (direction === 'in' ? -NUDGE_REM : NUDGE_REM) : 0
    return {
      key: group.map((s) => s.key).join('+'),
      leftPct: edge,
      topRem: index * pitchRem + heightRem / 2 + nudge,
      side,
      direction,
      headRight: (side === 'end') === (direction === 'out'),
      headFirst: direction === 'in',
      roomPct: Math.max(0, side === 'end' ? 100 - edge : edge),
      label: `${STUB_PREFIX[direction]} ${group.map((s) => s.name).join(', ')}`,
      detail: group.map((s) => s.detail).join('\n'),
      brokenByDays: Math.max(...group.map((s) => s.brokenByDays)),
      critical: group.some((s) => s.critical),
    }
  })
}

// The tasks at the far end of the links in `external`, for the driving path
// to step through (their dates came with the link).
export function externalTasks(external: TaskDependency[], onChart: { has(id: number): boolean }): TaskLink[] {
  return external.flatMap((d) => {
    const other = onChart.has(d.predecessor_id) ? d.successor : d.predecessor
    return other ? [other] : []
  })
}

// ---- Tasks a move shifted in other projects --------------------------------

// A task the server moved along with the one dragged (`rescheduled` in the
// update's response) that is not on the chart.
export interface MovedTask {
  id: number
  title: string
  project: string | null
  start_date: string | null
  due_date: string | null
}

// The `rescheduled` tasks of an update response (`PATCH /api/v1/tasks/:id`), if it has any.
export function rescheduledOf(response: unknown): Task[] {
  const list = (response as { rescheduled?: unknown } | null | undefined)?.rescheduled
  return Array.isArray(list) ? (list as Task[]) : []
}

// The folder of each task that has a link, as the server sent it with the link
// (the task's own, else its document's). The update response names only a
// task's own folder, so a task that sits in a document is placed through this.
export function linkedFolders(dependencies: TaskDependency[]): Map<number, number | null> {
  const folderOf = new Map<number, number | null>()
  dependencies.forEach((d) => {
    if (d.predecessor) folderOf.set(d.predecessor.id, d.predecessor.folder_id)
    if (d.successor) folderOf.set(d.successor.id, d.successor.folder_id)
  })
  return folderOf
}

// The rescheduled tasks that are not on the chart (the chart already shows its
// own), once each, as of the last time one was reported. `folders` is the
// Space's folder tree, to name their project; `folderOf` is `linkedFolders`.
export function movedElsewhere(rescheduled: Task[], onChart: { has(id: number): boolean }, folders: Folder[], folderOf: Map<number, number | null> = new Map()): MovedTask[] {
  const latest = new Map<number, Task>()
  rescheduled.forEach((task) => { if (!onChart.has(task.id)) latest.set(task.id, task) })
  return [...latest.values()].map((task) => {
    const folderId = taskFolderId(task) ?? folderOf.get(task.id) ?? null
    return {
      id: task.id,
      title: task.title,
      project: folderId != null ? projectOf(folders, folderId)?.name ?? null : null,
      start_date: task.start_date ?? null,
      due_date: task.due_date,
    }
  })
}

// "Vendor contract (Billing) to Nov 12", or "to Nov 10 - Nov 12" for a task with a start.
const movedTo = (task: MovedTask) => {
  if (!task.due_date) return ''
  const range = task.start_date && task.start_date !== task.due_date ? `${shortDate(task.start_date)} - ${shortDate(task.due_date)}` : shortDate(task.due_date)
  return ` to ${range}`
}

// What to tell the user after a move shifted tasks in other projects; null when none were.
export function movedMessage(moved: MovedTask[]): string | null {
  if (moved.length === 0) return null
  return `Also moved in other products: ${moved.map((task) => `${nameWithProject(task.title, task.project)}${movedTo(task)}`).join('; ')}`
}

// ---- The Space-wide list ---------------------------------------------------

export interface LinkEnd {
  id: number
  title: string
  project: { id: number; name: string } | null
  due_date: string | null
}

export interface CrossProjectLink {
  id: number
  kind: TaskDependency['kind']
  // The task that waits, and the one it waits on.
  waiting: LinkEnd
  waitedOn: LinkEnd
  // Days the dates break the link by; 0 when it holds (or a task has no due date).
  brokenByDays: number
}

function endOf(task: TaskLink, folders: Folder[]): LinkEnd {
  const project = task.folder_id != null ? projectOf(folders, task.folder_id) : null
  return { id: task.id, title: task.title, project: project ? { id: project.id, name: project.name } : null, due_date: task.due_date }
}

// The Space's links whose two tasks are in different projects (a task in no
// project counts as being elsewhere from one in a project), the ones whose
// dates break the link first, the most days first, then by project and title.
// Links the server sent without both tasks are left out, as their projects are unknown.
export function crossProjectLinks(dependencies: TaskDependency[], folders: Folder[]): CrossProjectLink[] {
  const links = dependencies.flatMap((d): CrossProjectLink[] => {
    if (!d.predecessor || !d.successor) return []
    const waitedOn = endOf(d.predecessor, folders)
    const waiting = endOf(d.successor, folders)
    if ((waiting.project?.id ?? null) === (waitedOn.project?.id ?? null)) return []
    const pred = spanOf(d.predecessor)
    const succ = spanOf(d.successor)
    const brokenByDays = pred && succ ? Math.max(0, linkDaysLate(d.kind, pred, succ)) : 0
    return [{ id: d.id, kind: d.kind, waiting, waitedOn, brokenByDays }]
  })
  const byName = (a: CrossProjectLink, b: CrossProjectLink) =>
    (a.waiting.project?.name ?? '').localeCompare(b.waiting.project?.name ?? '') || a.waiting.title.localeCompare(b.waiting.title)
  return links.sort((a, b) => b.brokenByDays - a.brokenByDays || byName(a, b) || a.id - b.id)
}
