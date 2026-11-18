import AppKit
import WebKit
import InertiaCore

/// The workspace's web view. Files dragged in are the web app's to handle (it uploads them), except task files
/// (`.inertia-tasks`), which open in the native task-file window.
final class TaskDropWebView: WKWebView {
    private func taskFiles(in sender: NSDraggingInfo) -> [URL] {
        let urls = sender.draggingPasteboard.readObjects(forClasses: [NSURL.self], options: [.urlReadingFileURLsOnly: true]) as? [URL]
        return TaskFileDrop.taskFiles(in: urls ?? [])
    }

    override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation {
        taskFiles(in: sender).isEmpty ? super.draggingEntered(sender) : .copy
    }

    override func draggingUpdated(_ sender: NSDraggingInfo) -> NSDragOperation {
        taskFiles(in: sender).isEmpty ? super.draggingUpdated(sender) : .copy
    }

    override func prepareForDragOperation(_ sender: NSDraggingInfo) -> Bool {
        taskFiles(in: sender).isEmpty ? super.prepareForDragOperation(sender) : true
    }

    override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
        let files = taskFiles(in: sender)
        guard !files.isEmpty else { return super.performDragOperation(sender) }
        for file in files {
            NSDocumentController.shared.openDocument(withContentsOf: file, display: true) { _, _, _ in }
        }
        return true
    }
}
