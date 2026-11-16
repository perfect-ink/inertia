# Portfolio

## What it does
`/portfolio` (the "Portfolio" button on the Projects page, the Space home) lists every active project in the Space in one table: project (a link to its folder overview), owner, status, dates, progress (done/total tasks with a bar) and health. Click a column header to sort (again to reverse; projects with no owner or date sort last). "Edit project details" goes to the Projects page, where owner, status, dates and description are set. Archived projects and plain folders are left out.

**Links between products**: under the table, "Links between products" lists every dependency in the Space whose two tasks are in different products (a task in no product counts as elsewhere from one in a product; a task in a subfolder is in its product). Each line reads "Build (Messages) waits on Vendor contract (Billing)", with both product names linking to the product's overview, then the link type, the other task's due date and, when the two tasks' dates no longer satisfy the link, a warning "Dates break this link by N days". The ones whose dates break the link come first (most days first), then the rest by product and title; the summary line says how many break. The section is hidden when there are no such links. It is read-only: links are made and removed on a product's Gantt tab (see [task_dependencies.md](task_dependencies.md)). The lines wrap and stack, so they read at 375px without sideways scrolling.

## API and models
`GET /api/v1/portfolio` (`PortfolioController`) returns one row per project with `owner_name`, `project_status`, dates, `tasks_count`, `done_tasks_count`, `percent` and `health`. Progress counts the tasks in the project's folder, its subfolders and their documents (`Folder#scheduled_tasks`). Health uses the shared `PlanningHealth` rule (a finished project or one with no target date is on track; a passed target date is off track; a target within 14 days with under 75% done is at risk). Frontend: `api/portfolio.ts`, `sortPortfolio` in `data/project.ts`, `view/portfolio/PortfolioScreen.tsx`. The links section reads `GET /api/v1/task_dependencies` (every link in the Space with both its tasks and their folder ids) and the Space's folder tree, through `useTaskDependencies` and `useWorkspace`; `crossProjectLinks` in `data/crossProjectLink.ts` picks and orders them (`view/portfolio/CrossProjectLinks.tsx`). Stacked on `backlog/project-details-owner-status-dates-and-a-description` (it needs those fields).

## Who can view and change
Anyone in the Space can view; nothing here changes data.

## Tests
`backend/test/controllers/portfolio_controller_test.rb`, `frontend/src/data/project.test.ts` (run with a stand-in runner: pass), `frontend/src/view/portfolio/PortfolioScreen.test.tsx`, `frontend/src/view/portfolio/CrossProjectLinks.test.tsx` (order, broken flag, project links, hidden when none), `frontend/src/data/crossProjectLink.test.ts` (`crossProjectLinks`).

## Known limits
- Counts only tasks (not documents or milestones), and one level of "project": a project nested inside another project is listed and counted separately, and its tasks also count toward the parent.
- No filters, grouping or saved views, and no inline editing here.
- One query pair per project (fine for tens of projects).
- The links list uses the dates as of the last time links loaded and has no sorting or filters of its own; a link inside one product (even between two of its folders) is not listed. A product nested in another counts as its own product.

## History
- Implemented 2026-10-19 on branch `backlog/portfolio-view`. Not merged or deployed.
- Not verified: migration (none needed beyond the project-details one), Rails tests, lint, type-check, the component test and the browser did not run (no database, no node_modules).

- Merged to main 2026-11-05 after running, merged with main: `rails db:migrate` (schema diff clean), `rails test`, `npm run lint`, `tsc -b`, Jest, and the collab-server tests, all passing. Not checked in a browser.
- 2026-11-16 (branch `backlog/draw-cross-project-links-on-the-gantt`, not merged, not deployed): the links between products list. Ran the stand-in Jest for `PortfolioScreen.test.tsx` and `CrossProjectLinks.test.tsx` and the pure data tests; not run: real Jest, lint, type-check, or the page in a browser at 375px and desktop.
