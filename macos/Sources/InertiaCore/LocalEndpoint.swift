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

    public static let developmentAPI = "http://localhost:3847"
    public static let developmentWeb = "http://localhost:5174"
}
