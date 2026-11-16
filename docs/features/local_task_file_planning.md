# Local task file: initiatives and milestones

## What it does
The `.inertia-tasks` file format (see `docs/task-file-format.md`) can hold the hosted app's planning hierarchy, **Milestone > Initiative > Epic > Task**: optional `milestones` and `initiatives` root arrays, `milestone_id` on tasks and epics, `initiative_id` on epics and `milestone_id` on initiatives. A task inherits its milestone from its epic, and an epic from its initiative (the same rule as `MilestoneRollup` in the backend). Progress per milestone and initiative is counted from done tasks. The fields mirror the Rails columns (`status` planned/active/done, `horizon` now/next/later on initiatives and epics, `position`, `folder_id`, owner, dates), so an object from the hosted API opens in a file as is and a later import can map them one to one.

The Mac app's local task-file window edits these levels. Its view switch reads **Workboard, List, Sprints, Milestones, Initiatives, Epics, Events** (top-down through the hierarchy, then the calendar):
- **Milestones** (`MilestoneList`, `MilestoneEditor`): New Milestone, then title, status (Planned, Active, Done), owner, target date and notes. Each row shows its status, target date, owner, the initiatives under it, and a progress bar from `TaskFile.progress(milestoneID:)` ("x of y tasks complete", counting tasks under it directly or by inheritance).
- **Initiatives** (`InitiativeList`, `InitiativeEditor`): New Initiative, then title, status, horizon (None, Now, Next, Later), owner, milestone, start and target dates and notes. Each row shows its status and horizon, dates, owner, milestone, the epics under it, and progress from `TaskFile.progress(initiativeID:)` (tasks under its epics).
- **Epics**: the epic editor gains an **Initiative** select and a **Milestone** select. The Epics list shows an epic's initiative and milestone (marked "(inherited)" when the milestone comes from the initiative).
- **Tasks**: the task editor gains a **Milestone** select. When the task sets none, the empty option reads "Inherited: <name>" (from its epic or the epic's initiative), or "None".
- **Remove**: right-click a row (the same context menu as epics and sprints): Remove Milestone (keeps initiatives, epics and tasks) and Remove Initiative (keeps epics). References to the removed record clear, as in Rails (`removeMilestone`, `removeInitiative`).
- Editors validate the whole file before saving (a candidate copy), so a bad date, an end before a start or a dangling link shows its message in the sheet and nothing is saved.

Labels keep the two kinds of "milestone" apart: the planning Milestone is the **Milestones** view and the "Milestone" select; a calendar milestone is an **Event** (the **Events** view, whose type select reads "Deadline" or "Milestone date"). The task editor's group of event checkboxes is titled "Events".

The select for a level appears only when the file has something to pick (no Initiative or Milestone select until one exists; no Owner select without users), so a file that does not plan looks as before.

The logic lives in `InertiaCore` and is tested: `TaskFile.save(_:)` for epics, initiatives and milestones (replace in place or append), `initiative(id:)` and `milestone(id:)`, `effectiveMilestoneID(of:)` for a task or an epic, `inheritedMilestoneID(epicID:)` and `inheritedMilestoneID(initiativeID:)`, `milestoneChoices(inherited:)` and `initiativeChoices()` (select options), and `SelectChoices.planningStatuses`, `.horizons`, `.eventTypes`. The SwiftUI screens use the shared Volta controls (`VoltaSelect`, `OptionalTextField`, `NotesEditor`, `CompletionProgress`, `EditorSheet`) and add no controls of their own.

## Compatibility
The version stays 4. The new arrays are omitted when empty, so a file that does not plan is byte-identical in shape to before (removing the last milestone or initiative in the editor drops the array again). A file that does plan is rejected by earlier version 4 builds ("Unrecognized file fields"), not silently stripped. `horizon` and `position` on an epic count the same way: an epic that carries them is not readable by an earlier build (the editor does not set an epic's `horizon` or `position`, only keeps what a file has).

## Who can view and change
Local files only; whoever has the file.

## Tests
`macos/Tests/InertiaCoreTests/PlanningLevelsTests.swift` (round trip, omission when unused, inheritance, progress, removal, validation, hosted-API columns, unknown fields) and `PlanningScreensTests.swift` (saving, lookups, the inherited milestone of an epic and a task, select options and their "Inherited: ..." label, event type labels, a file edited through the whole flow and written and read back, a dangling link caught by the editors' candidate validation). The SwiftUI screens have no tests: there is no UI test target.

## Known limits
- No sync with the hosted app (no automatic import, as for the rest of the format).
- The two kinds of "milestone" (the planning Milestone and a milestone-type Event) coexist in a file. Decision (conservative, for Alex to change): the **Events** view keeps showing events only and **Milestones** shows planning milestones only, rather than one view that mixes both.
- "View Tasks" (open the Workboard filtered to one) exists for epics and events, not for milestones and initiatives; the Workboard has no Milestone or Initiative filter.
- Milestone and initiative rows have no drag-to-reorder; the file's `position` is not set by the editor.
- Initiative progress counts tasks under its epics only. The hosted app also counts tasks in documents that name the initiative (`Initiative#rolled_up_tasks`); a file has no documents.
- `health` and the rollup counts of the hosted milestone and initiative are not stored; the file computes progress from its tasks.
- The window's minimum width grew from 850 to 960pt for the seven-segment view switch.

## History
- Implemented 2026-10-19 on branch `backlog/local-task-file-initiative-and-milestone-levels` (file format and model); merged to main.
- 2026-11-07: rebased onto `origin/main`. Checked against the backend: status and horizon values, the inheritance rule and the cascade on delete still match. Added the columns the hosted API gained since (`horizon` and `position` on epics, `position` and `folder_id` on initiatives).
- Implemented 2026-11-16 on branch `backlog/local-task-file-planning-screens`: the Milestones and Initiatives views, their editors, the epic and task pickers and the labels above. Renamed the calendar-event views and editor from `MilestoneList` and `MilestoneEditor` to `EventList` and `EventEditor`. Not merged, not deployed.
- Verified 2026-11-16: `swift build --disable-sandbox --target InertiaCore -Xswiftc -warnings-as-errors` passes. Every file of the SwiftUI app target type-checks with `swiftc -typecheck` against the built `InertiaCore` module (`@State` swapped for a same-shaped wrapper, since the macro plugin ships only with Xcode). `PlanningScreensTests`, `PlanningLevelsTests`, `TaskFileTests`, `SharedEntityTests`, `VoltaControlsTests`, `ISODateTests`, `RequestsTests` and `KeyChordTests` ran and passed under a small XCTest stand-in (XCTest is not installed here). Not run: `swift test`, `SignupTests` (async, not supported by the stand-in), the app build and how the screens look and behave when run (needs Xcode and a Mac session), lint.
