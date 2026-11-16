import XCTest
@testable import InertiaCore

/// What the Initiatives, Milestones, epic and task editors rely on: saving a record, the milestone
/// a task or epic inherits, the select options, and a file that was edited this way opening again.
final class PlanningScreensTests: XCTestCase {
    func testSavingAppendsANewRecordAndReplacesAnEditedOne() {
        var file = TaskFile(title: "Plan")
        var milestone = MilestoneRecord(title: "Launch")
        var initiative = InitiativeRecord(title: "Onboarding")
        var epic = EpicRecord(title: "Sign up")
        file.save(milestone); file.save(initiative); file.save(epic)
        XCTAssertEqual(file.milestoneList.count, 1); XCTAssertEqual(file.initiativeList.count, 1); XCTAssertEqual(file.epics.count, 1)
        milestone.title = "Launch day"; initiative.title = "Onboarding flow"; epic.title = "Sign up form"
        file.save(milestone); file.save(initiative); file.save(epic)
        XCTAssertEqual(file.milestoneList.map(\.title), ["Launch day"])
        XCTAssertEqual(file.initiativeList.map(\.title), ["Onboarding flow"])
        XCTAssertEqual(file.epics.map(\.title), ["Sign up form"])
    }
    func testSavingKeepsTheOrderOfTheList() {
        var file = TaskFile(title: "Plan")
        let first = MilestoneRecord(title: "A"), second = MilestoneRecord(title: "B")
        file.save(first); file.save(second)
        var edited = first; edited.title = "A2"
        file.save(edited)
        XCTAssertEqual(file.milestoneList.map(\.title), ["A2", "B"])
    }
    func testLookupsByOptionalID() {
        var file = TaskFile(title: "Plan")
        let milestone = MilestoneRecord(title: "Launch"), initiative = InitiativeRecord(title: "Onboarding")
        file.save(milestone); file.save(initiative)
        XCTAssertEqual(file.milestone(id: milestone.id)?.title, "Launch")
        XCTAssertEqual(file.initiative(id: initiative.id)?.title, "Onboarding")
        XCTAssertNil(file.milestone(id: nil)); XCTAssertNil(file.milestone(id: 5)); XCTAssertNil(file.initiative(id: nil))
    }
    /// Milestone > Initiative > Epic > Task: each level names the milestone it would inherit.
    func testInheritedMilestoneFollowsTheChain() {
        var file = TaskFile(title: "Plan")
        let launch = MilestoneRecord(title: "Launch"), beta = MilestoneRecord(title: "Beta")
        var initiative = InitiativeRecord(title: "Onboarding"); initiative.milestoneID = launch.id
        var epic = EpicRecord(title: "Sign up"); epic.initiativeID = initiative.id
        file.save(launch); file.save(beta); file.save(initiative); file.save(epic)
        XCTAssertEqual(file.inheritedMilestoneID(initiativeID: initiative.id), launch.id)
        XCTAssertEqual(file.inheritedMilestoneID(epicID: epic.id), launch.id)
        XCTAssertEqual(file.effectiveMilestoneID(of: epic), launch.id)
        XCTAssertNil(file.inheritedMilestoneID(initiativeID: nil)); XCTAssertNil(file.inheritedMilestoneID(epicID: nil))
        epic.milestoneID = beta.id; file.save(epic)
        XCTAssertEqual(file.effectiveMilestoneID(of: epic), beta.id)
        XCTAssertEqual(file.inheritedMilestoneID(epicID: epic.id), beta.id)
        var task = TaskRecord(title: "Build form", columnID: file.columns[1].id, status: .todo)
        task.epicID = epic.id
        XCTAssertEqual(file.effectiveMilestoneID(of: task), beta.id)
        task.milestoneID = launch.id
        XCTAssertEqual(file.effectiveMilestoneID(of: task), launch.id)
    }
    func testMilestoneChoicesNameTheInheritedOne() {
        var file = TaskFile(title: "Plan")
        XCTAssertEqual(file.milestoneChoices().map(\.label), ["None"])
        let launch = MilestoneRecord(title: "Launch"), beta = MilestoneRecord(title: "Beta")
        file.save(launch); file.save(beta)
        XCTAssertEqual(file.milestoneChoices().map(\.label), ["None", "Launch", "Beta"])
        XCTAssertEqual(file.milestoneChoices(inherited: beta.id).map(\.label), ["Inherited: Beta", "Launch", "Beta"])
        XCTAssertNil(file.milestoneChoices(inherited: beta.id)[0].value)
        XCTAssertEqual(file.milestoneChoices(inherited: 99).map(\.label), ["None", "Launch", "Beta"])
        XCTAssertEqual(file.initiativeChoices().map(\.label), ["None"])
        file.save(InitiativeRecord(title: "Onboarding"))
        XCTAssertEqual(file.initiativeChoices().map(\.label), ["None", "Onboarding"])
    }
    func testEventTypesAreLabelledApartFromThePlanningMilestone() {
        XCTAssertEqual(EventType.milestone.label, "Milestone date")
        XCTAssertEqual(EventType.deadline.label, "Deadline")
        XCTAssertEqual(SelectChoices.eventTypes.map(\.label), ["Deadline", "Milestone date"])
    }
    func testStatusAndHorizonOptions() {
        XCTAssertEqual(SelectChoices.planningStatuses.map(\.label), ["Planned", "Active", "Done"])
        XCTAssertEqual(SelectChoices.horizons.map(\.label), ["None", "Now", "Next", "Later"])
        XCTAssertNil(SelectChoices.horizons[0].value)
        XCTAssertEqual(SelectChoices.horizons[2].value, .next)
    }
    /// The whole editing flow, then the file is written and read back.
    func testAFileEditedThroughTheScreensStillOpens() throws {
        var file = TaskFile(title: "Plan")
        var owner = UserRecord(name: "Ada"); owner.id = 1
        file.users = [owner]
        var launch = MilestoneRecord(title: "Launch"); launch.targetDate = "2026-12-01"; launch.ownerID = owner.id
        file.save(launch)
        var initiative = InitiativeRecord(title: "Onboarding"); initiative.milestoneID = launch.id; initiative.horizon = .now
        initiative.startDate = "2026-10-01"; initiative.targetDate = "2026-11-15"; initiative.state = .active
        file.save(initiative)
        var epic = EpicRecord(title: "Sign up"); epic.initiativeID = initiative.id
        file.save(epic)
        var task = TaskRecord(title: "Build form", columnID: file.columns[4].id, status: .done)
        task.epicID = epic.id
        var loose = TaskRecord(title: "Book venue", columnID: file.columns[1].id, status: .todo)
        loose.milestoneID = launch.id
        file.tasks = [task, loose]
        let progress = file.progress(milestoneID: launch.id)
        XCTAssertEqual(progress.done, 1); XCTAssertEqual(progress.total, 2)
        XCTAssertEqual(file.progress(initiativeID: initiative.id).total, 1)
        var read = try TaskFile.read(file.data())
        XCTAssertEqual(read, file)
        // Delete the initiative, then the milestone: references clear and the file still opens.
        read.removeInitiative(initiative.id)
        XCTAssertNil(read.epics[0].initiativeID)
        read.removeMilestone(launch.id)
        XCTAssertNil(read.milestones); XCTAssertNil(read.initiatives); XCTAssertNil(read.tasks[1].milestoneID)
        let reopened = try TaskFile.read(read.data())
        XCTAssertEqual(reopened, read)
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: read.data()) as? [String: Any])
        XCTAssertNil(json["initiatives"]); XCTAssertNil(json["milestones"])
    }
    /// An editor validates a candidate file before saving, so a dangling link is caught there.
    func testACandidateWithADanglingLinkFailsValidation() {
        var file = TaskFile(title: "Plan")
        var epic = EpicRecord(title: "Sign up"); epic.initiativeID = 99
        var candidate = file; candidate.save(epic)
        XCTAssertThrowsError(try candidate.validate())
        let initiative = InitiativeRecord(title: "Onboarding"); file.save(initiative)
        epic.initiativeID = initiative.id
        candidate = file; candidate.save(epic)
        XCTAssertNoThrow(try candidate.validate())
    }
}
