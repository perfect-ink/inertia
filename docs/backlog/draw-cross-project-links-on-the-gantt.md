---
priority: p2
depends_on: []
components: [frontend, gantt]
branch: backlog/draw-cross-project-links-on-the-gantt
status: incomplete
---
# Draw cross-project links on the Gantt and in the portfolio

## Objective

Links between tasks in different projects are listed and made in a folder's dependency editor (`docs/features/task_dependencies.md`), but the chart does not draw them and nothing shows them across the Space. Show them where people plan.

## Requirements / notes

- On a folder's Gantt, draw the link to a task in another project as a stub arrow leaving or entering the bar, labelled with the other task and its project, and let the critical path follow it using the other task's dates (the server already sends them with the link).
- Decide how the browser's `planReschedule` should treat a cross-project link: today only the server does, so a drag in "Shift" mode moves tasks in other projects without the chart saying so. Show those moves (the update response lists them as `rescheduled`).
- A Space-wide list of cross-project links (for example on the Portfolio), with the ones whose dates break the link first.
- Mobile: the list must read at 375px without sideways scrolling.

## Acceptance criteria

- A link between two projects is visible on the Gantt of either project, and a move that shifts a task in another project says so.
- The Portfolio (or another Space-wide page) lists cross-project links and flags broken ones.
- Tests cover the new behaviour; the feature docs for task dependencies and the portfolio are updated and this file is removed.

## Unverified

Built on branch `backlog/draw-cross-project-links-on-the-gantt` (no migration, no backend or API change):

- Gantt: a link with one end on the chart is drawn as a stub leaving or entering the bar, labelled with the other task and its product, a warning when its dates break the link, red when on the driving path (`components/TimelineStubs.tsx`, `data/crossProjectLink.ts`). The critical path now steps through the other task by its dates (`drivingPath`'s third argument).
- Decision for Alex: `planReschedule` stays chart-only. The server is the authority for links across products (it also knows the other products' links), so the chart reports what the server did: the update response's `rescheduled` tasks that are not on the chart are named under the toolbar ("Also moved in other products: ..."). A *Block* refusal across products therefore comes from the server after the drag. Say if the browser should compute those moves itself instead (it would need the other products' tasks and links loaded).
- Portfolio: "Links between products", broken ones first, read-only, stacked lines that wrap at 375px (`view/portfolio/CrossProjectLinks.tsx`).
- Overlaps `backlog/gantt-keyboard-and-global-reschedule`: `frontend/src/components/Timeline.tsx` (a `stubs` prop, one `placeStubs` call and one `<TimelineStubs>` line), `docs/features/gantt_scheduling.md` (one sentence and a History line) and `docs/features/README.md`.

Rebased onto `origin/main` d8d1ce27 on 2026-11-20 (the Products rename: user-facing text says product, code keeps `project`; the two-sidebar navigation did not touch the Gantt or Portfolio files) and re-ran the checks below.

Ran here: the offline static checks (parse, imports, Sass compile), the pure data tests (`crossProjectLink.test.ts`, `dependency.test.ts`), and stand-in Jest runs of `TimelineStubs.test.tsx`, `GanttPane.test.tsx`, `GanttPane.reschedule.test.tsx`, `PortfolioScreen.test.tsx` and `CrossProjectLinks.test.tsx` (the runner's react-query stub needed `QueryClientProvider` added for the Gantt ones; `GanttPane.reschedule.test.tsx > shows the reason when the server refuses a move` fails only because the stand-in axios has no `isAxiosError`, as on main).

Not run (no network, node_modules or database): `npm run lint` (ESLint and Stylelint), `npx tsc -b`, the real Jest, and a look in a browser. To verify:

```sh
cd frontend && npm install && npm run lint && npx tsc -b && npm test
```

Then in a browser, in light and dark and at 375px and desktop: open a product's Gantt (`/folders/:id?view=gantt`) with a link to a task in another product and check the stub (arrowhead at the bar when entering, at the far end when leaving; the label is cut short rather than running off the chart; the warning icon on a broken link; red when on the critical path), drag a bar in Shift mode with a link across products and check the "Also moved in other products" note, and open `/portfolio` to check the list reads without sideways scrolling.
