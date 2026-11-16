import SwiftUI
import InertiaCore

struct EpicList: View {
    @Binding var board: TaskFile
    let showTasks: (Int) -> Void
    @State private var draft: EpicRecord?
    var body: some View {
        VStack(alignment: .leading) {
            Button("New Epic", systemImage: "plus") { draft = EpicRecord() }.buttonStyle(.volta(.secondary)).padding()
            List {
                if board.epics.isEmpty { Text("Group related tasks into an epic, even across sprints.").voltaMuted() }
                ForEach(board.epics) { epic in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Button(epic.title) { draft = epic }.buttonStyle(.voltaLink(.title))
                            Spacer()
                            Button("View Tasks") { showTasks(epic.id) }.buttonStyle(.volta(.secondary))
                        }
                        if !epic.notes.isEmpty { Text(epic.notes).voltaMuted() }
                        Text("\(epic.startDate ?? "No start date") – \(epic.targetDate ?? "No target date")").voltaCaption()
                        if let initiative = board.initiative(id: epic.initiativeID) {
                            Label(initiative.title, systemImage: "target").voltaCaption()
                        }
                        if let milestone = board.milestone(id: board.effectiveMilestoneID(of: epic)) {
                            Label(epic.milestoneID == nil ? "\(milestone.title) (inherited)" : milestone.title, systemImage: "diamond").voltaCaption()
                        }
                        let total = board.tasks.filter { $0.epicID == epic.id }.count
                        let done = board.completedCount(epicID: epic.id)
                        CompletionProgress(done: done, total: total)
                        ForEach(board.events.filter { $0.epicID == epic.id }) { event in
                            Label("\(event.title) · \(event.targetDate ?? "Unscheduled")", systemImage: event.completed ? "flag.checkered" : "flag")
                                .voltaCaption()
                        }
                    }.padding(.vertical, 8).contextMenu {
                        Button("Edit Epic") { draft = epic }
                        Button("Remove Epic (Keep Tasks and Events)", role: .destructive) { board.removeEpic(epic.id) }
                    }
                }
            }.scrollContentBackground(.hidden)
        }.voltaWindow().sheet(item: $draft) { epic in
            EpicEditor(draft: epic, board: board) { updated in
                board.save(updated)
                draft = nil
            }
        }
    }
}
/// The planning Milestones: target dates that initiatives, epics and tasks roll up to.
struct MilestoneList: View {
    @Binding var board: TaskFile
    @State private var draft: MilestoneRecord?
    var body: some View {
        VStack(alignment: .leading) {
            Button("New Milestone", systemImage: "plus") { draft = MilestoneRecord() }.buttonStyle(.volta(.secondary)).padding()
            List {
                if board.milestoneList.isEmpty {
                    Text("A Milestone is a target date that initiatives, epics and tasks roll up to. Calendar dates are Events.").voltaMuted()
                }
                ForEach(board.milestoneList) { milestone in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Image(systemName: "diamond").accessibilityHidden(true)
                            Button(milestone.title) { draft = milestone }.buttonStyle(.voltaLink(.title))
                            Spacer()
                            Text(milestone.state.label).voltaMuted()
                        }
                        if !milestone.notes.isEmpty { Text(milestone.notes).voltaMuted() }
                        Text(milestone.targetDate ?? "No target date").voltaCaption()
                        if let owner = board.users.first(where: { $0.id == milestone.ownerID }) {
                            Label(owner.name, systemImage: "person").voltaCaption()
                        }
                        ForEach(board.initiativeList.filter { $0.milestoneID == milestone.id }) { initiative in
                            Label(initiative.title, systemImage: "target").voltaCaption()
                        }
                        let progress = board.progress(milestoneID: milestone.id)
                        CompletionProgress(done: progress.done, total: progress.total)
                    }.padding(.vertical, 8).contextMenu {
                        Button("Edit Milestone") { draft = milestone }
                        Button("Remove Milestone (Keep Initiatives, Epics and Tasks)", role: .destructive) { board.removeMilestone(milestone.id) }
                    }
                }
            }.scrollContentBackground(.hidden)
        }.voltaWindow().sheet(item: $draft) { milestone in
            MilestoneEditor(draft: milestone, board: board) { updated in
                board.save(updated)
                draft = nil
            }
        }
    }
}
struct InitiativeList: View {
    @Binding var board: TaskFile
    @State private var draft: InitiativeRecord?
    var body: some View {
        VStack(alignment: .leading) {
            Button("New Initiative", systemImage: "plus") { draft = InitiativeRecord() }.buttonStyle(.volta(.secondary)).padding()
            List {
                if board.initiativeList.isEmpty {
                    Text("An Initiative groups epics under one goal, and can sit under a Milestone.").voltaMuted()
                }
                ForEach(board.initiativeList) { initiative in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Image(systemName: "target").accessibilityHidden(true)
                            Button(initiative.title) { draft = initiative }.buttonStyle(.voltaLink(.title))
                            Spacer()
                            if let horizon = initiative.horizon { Text(horizon.label).voltaMuted() }
                            Text(initiative.state.label).voltaMuted()
                        }
                        if !initiative.notes.isEmpty { Text(initiative.notes).voltaMuted() }
                        Text("\(initiative.startDate ?? "No start date") – \(initiative.targetDate ?? "No target date")").voltaCaption()
                        if let owner = board.users.first(where: { $0.id == initiative.ownerID }) {
                            Label(owner.name, systemImage: "person").voltaCaption()
                        }
                        if let milestone = board.milestone(id: initiative.milestoneID) {
                            Label(milestone.title, systemImage: "diamond").voltaCaption()
                        }
                        ForEach(board.epics.filter { $0.initiativeID == initiative.id }) { epic in
                            Label(epic.title, systemImage: "square.stack.3d.up").voltaCaption()
                        }
                        let progress = board.progress(initiativeID: initiative.id)
                        CompletionProgress(done: progress.done, total: progress.total)
                    }.padding(.vertical, 8).contextMenu {
                        Button("Edit Initiative") { draft = initiative }
                        Button("Remove Initiative (Keep Epics)", role: .destructive) { board.removeInitiative(initiative.id) }
                    }
                }
            }.scrollContentBackground(.hidden)
        }.voltaWindow().sheet(item: $draft) { initiative in
            InitiativeEditor(draft: initiative, board: board) { updated in
                board.save(updated)
                draft = nil
            }
        }
    }
}
/// Calendar Events: deadlines and milestone dates, kept apart from the planning Milestones.
struct EventList: View {
    @Binding var board: TaskFile
    let showTasks: (Int) -> Void
    @State private var draft: EventRecord?
    var body: some View {
        VStack(alignment: .leading) {
            Button("New Event", systemImage: "plus") { draft = EventRecord() }.buttonStyle(.volta(.secondary)).padding()
            List {
                if board.events.isEmpty { Text("Add an event for a release, review, or delivery date.").voltaMuted() }
                ForEach(board.events) { event in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Toggle("Reached", isOn: Binding(get: { event.completed }, set: { value in
                                if let index = board.events.firstIndex(where: { $0.id == event.id }) { board.events[index].completed = value }
                            }))
                            Button(event.title) { draft = event }.buttonStyle(.voltaLink(.title))
                            Spacer()
                            Text(event.targetDate ?? "Unscheduled").voltaMuted()
                            Button("View Tasks") { showTasks(event.id) }.buttonStyle(.volta(.secondary))
                        }
                        if !event.notes.isEmpty { Text(event.notes).voltaMuted() }
                        if let epic = board.epics.first(where: { $0.id == event.epicID }) {
                            Label(epic.title, systemImage: "square.stack.3d.up").voltaCaption()
                        }
                        Text("\(board.taskIDs(for: event.id).count) linked tasks").voltaCaption()
                    }.padding(.vertical, 8).contextMenu {
                        Button("Edit Event") { draft = event }
                        Button("Remove Event (Keep Tasks)", role: .destructive) { board.removeEvent(event.id) }
                    }
                }
            }.scrollContentBackground(.hidden)
        }.voltaWindow().sheet(item: $draft) { event in
            EventEditor(draft: event, epics: board.epics) { updated in
                if let index = board.events.firstIndex(where: { $0.id == updated.id }) { board.events[index] = updated }
                else { board.events.append(updated) }
                draft = nil
            }
        }
    }
}
