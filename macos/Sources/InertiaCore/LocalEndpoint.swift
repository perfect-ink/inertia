import Foundation

/// Whether an API address points at this machine, where the app skips the sign-in screen.
public enum LocalEndpoint {
    public static func isLocal(_ url: URL) -> Bool {
        guard let host = url.host?.lowercased() else { return false }
        return host == "localhost" || host == "127.0.0.1" || host == "::1" || host.hasSuffix(".localhost")
    }

    /// A build made by `make mac-build` runs from `build/Inertia.app`; the installed app lives in /Applications.
    public static func isDevelopmentBuild(bundlePath: String) -> Bool {
        bundlePath.hasSuffix("/build/Inertia.app")
    }

    /// The checkout a development build was made in (`<root>/build/Inertia.app`), where `make up-d` starts the servers.
    public static func repositoryRoot(bundlePath: String) -> String? {
        guard isDevelopmentBuild(bundlePath: bundlePath) else { return nil }
        let root = String(bundlePath.dropLast("/build/Inertia.app".count))
        return root.isEmpty ? nil : root
    }

    public static let developmentAPI = "http://localhost:3847"
    public static let developmentWeb = "http://localhost:5174"
}

/// Where a development build talks to, asked once on first launch and remembered. A local choice runs the
/// servers on this Mac (the app starts them); cloud is the hosted app.
public enum ServerChoice: String, CaseIterable {
    case local, cloud

    public static let defaultsKey = "server_choice"

    public var api: String { self == .local ? LocalEndpoint.developmentAPI : "https://inertia.it.com" }
    public var web: String { self == .local ? LocalEndpoint.developmentWeb : "https://inertia.it.com" }
}
