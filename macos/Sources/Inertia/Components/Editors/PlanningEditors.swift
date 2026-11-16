import SwiftUI
import InertiaCore

struct EpicEditor: View {
    @State var draft: EpicRecord
    let board: TaskFile
    let save: (EpicRecord) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var error: String?
    var body: some View {
        EditorSheet(title: "Epic", width: 480) {
            Form {
                TextField("Title", text: $draft.title)
                if !board.initiativeList.isEmpty {
                    VoltaSelect("Initiative", selection: $draft.initiativeID, options: board.initiativeChoices())
                }
                if !board.milestoneList.isEmpty {
                    VoltaSelect("Milestone", selection: $draft.milestoneID,
                                options: board.milestoneChoices(inherited: board.inheritedMilestoneID(initiativeID: draft.initiativeID)))
                }
                OptionalTextField(title: "Start (YYYY-MM-DD)", text: $draft.startDate, rule: .isoDate)
                OptionalTextField(title: "Target (YYYY-MM-DD)", text: $draft.targetDate, rule: .isoDate)
            }
            NotesEditor(text: $draft.notes)
            ValidationMessage(message: error)
            EditorActions(saveDisabled: draft.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, cancel: { dismiss() }) {
                var candidate = board; candidate.save(draft)
                do { try candidate.validate(); save(draft) }
                catch { self.error = error.localizedDescription }
            }
        }
    }
}
/// The planning Milestone: a target date that initiatives, epics and tasks roll up to.
struct MilestoneEditor: View {
    @State var draft: MilestoneRecord
    let board: TaskFile
    let save: (MilestoneRecord) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var error: String?
    var body: some View {
        EditorSheet(title: "Milestone", width: 480) {
            Form {
                TextField("Title", text: $draft.title)
                VoltaSelect("Status", selection: $draft.state, options: SelectChoices.planningStatuses)
                if !board.users.isEmpty {
                    VoltaSelect("Owner", selection: $draft.ownerID, options: SelectChoices.optional(none: "No owner", board.users, id: \.id, label: \.name))
                }
                OptionalTextField(title: "Target (YYYY-MM-DD)", text: $draft.targetDate, rule: .isoDate)
            }
            NotesEditor(text: $draft.notes)
            ValidationMessage(message: error)
            EditorActions(saveDisabled: draft.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, cancel: { dismiss() }) {
                var candidate = board; candidate.save(draft)
                do { try candidate.validate(); save(draft) }
                catch { self.error = error.localizedDescription }
            }
        }
    }
}
struct InitiativeEditor: View {
    @State var draft: InitiativeRecord
    let board: TaskFile
    let save: (InitiativeRecord) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var error: String?
    var body: some View {
        EditorSheet(title: "Initiative", width: 480) {
            Form {
                TextField("Title", text: $draft.title)
                VoltaSelect("Status", selection: $draft.state, options: SelectChoices.planningStatuses)
                VoltaSelect("Horizon", selection: $draft.horizon, options: SelectChoices.horizons)
                if !board.users.isEmpty {
                    VoltaSelect("Owner", selection: $draft.ownerID, options: SelectChoices.optional(none: "No owner", board.users, id: \.id, label: \.name))
                }
                if !board.milestoneList.isEmpty {
                    VoltaSelect("Milestone", selection: $draft.milestoneID, options: board.milestoneChoices())
                }
                OptionalTextField(title: "Start (YYYY-MM-DD)", text: $draft.startDate, rule: .isoDate)
                OptionalTextField(title: "Target (YYYY-MM-DD)", text: $draft.targetDate, rule: .isoDate)
            }
            NotesEditor(text: $draft.notes)
            ValidationMessage(message: error)
            EditorActions(saveDisabled: draft.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, cancel: { dismiss() }) {
                var candidate = board; candidate.save(draft)
                do { try candidate.validate(); save(draft) }
                catch { self.error = error.localizedDescription }
            }
        }
    }
}
/// A calendar Event (a deadline or a milestone date). Not the planning Milestone.
struct EventEditor: View {
    @State var draft: EventRecord
    let epics: [EpicRecord]
    let save: (EventRecord) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var error: String?
    var body: some View {
        EditorSheet(title: "Event", width: 480) {
            Form {
                TextField("Title", text: $draft.title)
                VoltaSelect("Type", selection: $draft.event_type, options: SelectChoices.eventTypes)
                OptionalTextField(title: "Date (YYYY-MM-DD)", text: $draft.date, rule: .isoDate)
                VoltaSelect("Epic (file extension)", selection: $draft.epicID, options: SelectChoices.optional(none: "None", epics, id: \.id, label: \.title))
                Toggle("Reached", isOn: $draft.completed)
            }
            NotesEditor(text: $draft.notes)
            ValidationMessage(message: error)
            EditorActions(saveDisabled: draft.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, cancel: { dismiss() }) {
                var candidate = TaskFile(); candidate.epics = epics; candidate.events = [draft]
                do { try candidate.validate(); save(draft) }
                catch { self.error = error.localizedDescription }
            }
        }
    }
}
