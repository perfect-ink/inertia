import Foundation

/// Task files (`.inertia-tasks`) dropped on the workspace window open in the native task-file window; every other
/// file is left to the web app, which uploads it.
public enum TaskFileDrop {
    public static let fileExtension = "inertia-tasks"

    public static func taskFiles(in urls: [URL]) -> [URL] {
        urls.filter { $0.isFileURL && $0.pathExtension.lowercased() == fileExtension }
    }
}
