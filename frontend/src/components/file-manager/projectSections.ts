import type { ProjectFeature } from '@/data/projectFeature'

export type Section = {
  label: string
  path: string
  // The project feature that shows or hides it (data/projectFeature.ts).
  feature?: ProjectFeature
  // Only useful when other people can open the Space, so hidden until then.
  sharedOnly?: boolean
}

export const TASKS_HEADING = 'Tasks'

// The pages under an open project, grouped by what they're for. Each lists
// only that project's records (the API reads X-Project-Id, see backend
// ProjectScoped). The first group has no heading. The project sidebar shows
// Tasks on its own and the rest under Views, as plain text. A project can turn
// pages off (`feature`, docs/features/project_features.md).
export const SECTION_GROUPS: { heading: string | null; sections: Section[] }[] = [
  { heading: null, sections: [
    { label: 'My work', feature: 'my_work', path: '/my-work', sharedOnly: true },
  ] },
  { heading: TASKS_HEADING, sections: [
    { label: 'Tasks', feature: 'tasks', path: '/tasks?view=backlog' },
    { label: 'Task table', feature: 'task_table', path: '/task-table' },
    { label: 'Pivot', feature: 'pivot', path: '/pivot' },
    { label: 'Calendar', feature: 'calendar', path: '/calendar' },
    { label: 'Events', feature: 'events', path: '/events?view=list' },
  ] },
  { heading: 'Planning', sections: [
    { label: 'Roadmap', feature: 'roadmap', path: '/roadmap' },
    { label: 'Timeline', feature: 'timeline', path: '/timeline' },
    { label: 'Milestones', feature: 'milestones', path: '/milestones' },
    { label: 'Initiatives', feature: 'initiatives', path: '/initiatives' },
    { label: 'Epics', feature: 'epics', path: '/epics' },
    { label: 'Sprints', feature: 'sprints', path: '/sprints' },
    { label: 'Hierarchy', feature: 'hierarchy', path: '/hierarchy' },
  ] },
  { heading: 'Goals', sections: [
    { label: 'OKRs', feature: 'okrs', path: '/okrs' },
    { label: 'Objectives map', feature: 'objectives_map', path: '/objectives-map' },
    { label: 'Ideas', feature: 'ideas', path: '/ideas' },
  ] },
  { heading: 'Delivery', sections: [
    { label: 'Resources', feature: 'resources', path: '/resources' },
    { label: 'Workload', feature: 'workload', path: '/workload', sharedOnly: true },
  ] },
]

// The project's main task page, which the project sidebar lists on its own.
export const TASKS_SECTION: Section = SECTION_GROUPS.flatMap((g) => g.sections).find((s) => s.feature === 'tasks')!

// Every other page, listed under Views in the project sidebar.
export const VIEW_SECTIONS: Section[] = SECTION_GROUPS.flatMap((g) => g.sections).filter((s) => s !== TASKS_SECTION)
