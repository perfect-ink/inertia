---
priority: p2
depends_on: [local-task-file-initiative-and-milestone-levels]
components: [macos]
branch: backlog/local-task-file-planning-screens
status: incomplete
---
# Mac screens for Initiatives and Milestones in a local task file

## Objective

Let a person create, edit, link and delete Initiatives and Milestones in the Mac app's local `.inertia-tasks` editor, now that the file format and model hold them.

## Current state

`InertiaCore` reads, validates and writes `initiatives` and `milestones` (see `docs/features/local_task_file_planning.md`), with inheritance and progress helpers on `TaskFile`. The SwiftUI local editor has Workboard, List, Sprints, Epics and Milestones (milestone-type events) views and nothing for the planning levels. The online workspace in the Mac app already has the Initiatives and Milestones pages, because it is the web app in a WKWebView.

## Requirements / notes

- Add planning views to the local editor under `macos/Sources/Inertia/Components/Screens/` using the shared native controls, not a new layout.
- Epic editor gains an Initiative and a Milestone picker; the task editor gains a Milestone picker showing the inherited one when none is set.
- Show progress from `TaskFile.progress(milestoneID:)` and `progress(initiativeID:)`.
- Label the planning Milestone so it is not confused with a milestone-type Event (the file keeps both).
- Decide with Alex whether the existing "Milestones" view should show both kinds.

## Acceptance criteria

- Initiatives and Milestones can be created, edited, linked to epics, tasks and each other, and deleted from the local editor; deleting clears references (already in the model).
- A file edited this way still opens in the model tests.
- `swift build` of the app target and the Swift tests pass on a Mac with Xcode; the feature doc and `macos/README.md` are updated and this file is removed.

## Unverified

Built on branch `backlog/local-task-file-planning-screens` (see `docs/features/local_task_file_planning.md`): Milestones and Initiatives views and editors, an Initiative and a Milestone select on the epic editor, a Milestone select on the task editor (empty option reads "Inherited: <name>"), progress on each row, remove from the context menu. The logic is in `InertiaCore` with tests (`PlanningScreensTests.swift`).

Decisions made for Alex (conservative, change them if wrong):
- The existing view (already named Events) keeps showing calendar events only; Milestones shows planning milestones only. Event types read "Deadline" and "Milestone date" so they are not confused with a planning Milestone.
- A select (Initiative, Milestone, Owner) shows only when the file has something to pick.
- No Workboard filter by milestone or initiative and no "View Tasks" for them (not in the spec).

Ran here: `cd macos && swift build --disable-sandbox --target InertiaCore -Xswiftc -warnings-as-errors` (passes); `/tmp/runner/swift-app-typecheck.sh` over the whole app target (passes; `@State` swapped for a stand-in wrapper); `PlanningScreensTests`, `PlanningLevelsTests`, `TaskFileTests`, `SharedEntityTests`, `VoltaControlsTests`, `ISODateTests`, `RequestsTests`, `KeyChordTests` under an XCTest stand-in (all pass).

Not run (needs a Mac with full Xcode): `swift test` (XCTest, plus `SignupTests`), `swift build` of the app target (`make build-mac`), and a look at the screens: the seven-segment view switch at 960pt wide, the sheets, the select menus, light and dark, keyboard and VoiceOver. To verify:

```sh
cd macos && swift build && swift test
make build-mac   # then open a task file, add a Milestone, an Initiative, link an epic and a task, remove each, save and reopen
```
