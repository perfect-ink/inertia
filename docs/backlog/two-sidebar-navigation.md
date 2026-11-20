---
priority: p1
components: frontend
---

# Two-sidebar navigation: Space and projects, then the project's documents and tasks

## Objective

Alex (2026-11-20): the interface is too complex, with too much text and too many icons. The path through the app should be simple: pick a Space, see its projects, pick one, then see all of that project's documents and tasks.

## Requirements

- **Primary sidebar, far left, collapsible.**
  - The Space switcher at the top.
  - Recent projects underneath it (the projects opened most recently, then the rest, up to five), with a way to see all projects and start a new one.
  - The user profile at the very bottom, holding the account menu (quick add, shortcuts, appearance, import, sign out).
  - Collapsing it leaves a narrow column of the Space logo, project icons and the avatar. The choice is remembered on the device.
- **Secondary sidebar: the open project.**
  - The project's name at the top, opening the project menu (switch project, overview, change icon, choose pages, all projects).
  - Its tasks and its documents (documents, sheets, Collections, folders and files), with one "+" menu to create any of them.
  - Shown only when a project is open; on the Space home (`/space`) the page itself lists the projects.
- **The icon items (sprints, OKRs, roadmap and the rest).** They move off the icon rail into a collapsible **Views** list in the project sidebar: plain text rows, no icons, collapsed by default and opened automatically when one of them is the current page. Only the pages the project has turned on are listed (Choose pages). The icon rail is removed.
- Fewer icons and less text throughout: one "+" menu instead of four create buttons, and no per-row icons in the Views list.

## Acceptance criteria

- The layout is primary sidebar, project sidebar, then the page.
- The primary sidebar collapses and expands from a button and remembers the choice.
- Recent projects reflect the projects last opened.
- Every page that used to be on the icon rail can be reached from Views (or Inbox in the primary sidebar).
- Works at 375px: the drawer holds the compact primary sidebar and the project sidebar.
- Hover only on clickable things; animations 150ms; nothing shown without value (no empty Views, no Pinned without pins).
