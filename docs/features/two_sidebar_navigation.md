# Two-sidebar navigation

Projects are called **Products** in the UI (code keeps `project`). Pick a Space, see its products, pick one, then see that project's tasks and documents. The web app (and the Mac app, which loads the same layout) has two sidebars to the left of the page.

## Primary sidebar (Space)

`frontend/src/components/file-manager/SpaceSidebar.tsx`

- The Space switcher at the top (switch, create, members, teams).
- **Products**: the five products opened most recently on this device, then the rest by name (`recentProjects` in `data/project.ts`, ids kept in `store/projects.ts`). The heading opens the Space home (`/space`), the + makes a new product, and "All products" shows when there are more than five.
- **Pinned** documents, only when something is pinned.
- At the bottom: Inbox with its unread count, and the signed-in person, whose menu holds quick add, keyboard shortcuts, appearance, Import from Quip, getting started and sign out.
- The button beside the Space name collapses it to a column of icons (logo, project icons, bell, avatar), with each name as a tooltip. Remembered on the device (`store/sidebar.ts`, `collapsed`).
- Opening a document or folder inside a project opens that project; a project that is archived, deleted or moved away closes.

## Project sidebar

`frontend/src/components/file-manager/ProjectSidebar.tsx`, shown only while a project is open (not on `/space`).

- The project's name opens its menu: switch product, Overview, New product, Change icon, Choose pages (writers), All products.
- **Tasks**: the project's task page.
- **Documents**: the project's documents, sheets, Collections, folders and files as a tree. The heading opens the project's file list (`/documents`); one + menu creates a document, sheet, Collection or folder.
- **Views**, at the bottom: every other page the project shows (My work, Task table, Pivot, Calendar, Events, Roadmap, Timeline, Milestones, Initiatives, Epics, Sprints, Hierarchy, OKRs, Objectives map, Ideas, Resources, Workload) as plain names without icons. Folded by default (remembered, `viewsOpen`); the page you are on stays listed when folded. Pages the project turned off (Choose pages) and pages only useful in a shared Space are left out, and with none left the list doesn't show. The list comes from `projectSections.ts` (`TASKS_SECTION`, `VIEW_SECTIONS`).

The Space home (`/space`) gains **All files** (every file in the Space) and **Archived** (archived projects, with Unarchive; shown only when there are some), which used to sit on the sidebar's project list.

## Phones

Below 768px both sidebars are one drawer, opened from the top bar's menu button. With a project open the primary sidebar stays in its icon column beside the project sidebar; with none open it shows names. The drawer is opaque and closes on a tap outside or after navigating.

## Tests

`SpaceSidebar.test.tsx`, `ProjectSidebar.test.tsx`, `view/projects/ProjectsScreen.test.tsx`, `data/project.test.ts` (`recentProjects`).

## Known limits

- Recent projects are per device, not per account.
- The Space-wide `/documents` list is reached from the Space home; the project sidebar's Documents heading lists only the open project's files.

## History

- Implemented 2026-11-20 (Alex: the UI had too much text and too many icons). Replaced the icon rail (`SidebarRail`) and the single panel (`ProjectNav`). Jest, ESLint (no errors) and Stylelint pass; checked in Chromium at 1280px (expanded and collapsed) and 375px against a stubbed API, not against a running backend. Not deployed (deploys are manual).
- 2026-11-21: the two sidebars have their own background colours (`--nav-primary` and `--nav-secondary` in `styles/_theme.scss`, light and dark): the Space sidebar is the deepest, the product sidebar sits between it and the page. With a tinted colour theme the product sidebar is a shade lighter than the Space sidebar.
