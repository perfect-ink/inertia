import XCTest
@testable import InertiaCore

final class TaskFileDropTests: XCTestCase {
    func testKeepsOnlyTaskFiles() {
        let urls = [
            URL(fileURLWithPath: "/tmp/Plan.inertia-tasks"),
            URL(fileURLWithPath: "/tmp/Photo.PNG"),
            URL(fileURLWithPath: "/tmp/Other.INERTIA-TASKS"),
            URL(string: "https://example.com/web.inertia-tasks")!,
        ]
        XCTAssertEqual(TaskFileDrop.taskFiles(in: urls).map(\.lastPathComponent), ["Plan.inertia-tasks", "Other.INERTIA-TASKS"])
    }

    func testNoTaskFilesInAnOrdinaryDrop() {
        XCTAssertTrue(TaskFileDrop.taskFiles(in: [URL(fileURLWithPath: "/tmp/a.pdf")]).isEmpty)
    }
}
