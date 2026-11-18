import SwiftUI
import InertiaCore
import AuthenticationServices
import os

@MainActor final class Session: ObservableObject {
    // Production by default. INERTIA_API_URL and INERTIA_WEB_URL override both endpoints. A development
    // build (build/Inertia.app) asks once whether to use the local servers or the cloud, and remembers it.
    private static let developmentBuild = LocalEndpoint.isDevelopmentBuild(bundlePath: Bundle.main.bundlePath)
    private static let environment = ProcessInfo.processInfo.environment
    @Published private(set) var serverChoice = UserDefaults.standard.string(forKey: ServerChoice.defaultsKey).flatMap(ServerChoice.init)
    var api: URL { URL(string: Self.environment["INERTIA_API_URL"] ?? serverChoice?.api ?? "https://inertia.it.com")! }
    var web: URL { URL(string: Self.environment["INERTIA_WEB_URL"] ?? serverChoice?.web ?? "https://inertia.it.com")! }
    /// True on a development build with no endpoint override and no remembered choice yet.
    var needsServerChoice: Bool { Self.developmentBuild && Self.environment["INERTIA_API_URL"] == nil && serverChoice == nil }
    var canChooseServer: Bool { Self.developmentBuild && Self.environment["INERTIA_API_URL"] == nil }
    @Published var token: String?
    @Published var user: Login.User?
    @Published var error: String?
    @Published var busy = false
    private let socialSignIn = SocialSignIn()
    /// `make logs-mac` streams these (subsystem com.inertia.native).
    private let log = Logger(subsystem: "com.inertia.native", category: "session")
    private var triedLocalSignIn = false
    /// True while a development build starts the local servers (`make up-d`) and waits for the API.
    @Published var startingServer = false

    /// Local has no authentication. Against a local API the app starts the servers if they are down, then opens
    /// the workspace with a placeholder session: the local API runs with BYPASS_AUTH (the dev default in
    /// docker-compose.yml), which answers every request as the seeded user and ignores the token. Only the cloud
    /// asks for a sign-in. Once per launch, so signing out still reaches the sign-in screen.
    func signInIfLocal() async {
        log.info("Local sign-in check: token \(self.token == nil ? "none" : "set", privacy: .public), tried \(self.triedLocalSignIn), needs choice \(self.needsServerChoice), api \(self.api.absoluteString, privacy: .public), bundle \(Bundle.main.bundlePath, privacy: .public)")
        guard token == nil, !triedLocalSignIn, !needsServerChoice, LocalEndpoint.isLocal(api) else { return }
        triedLocalSignIn = true
        _ = await startLocalServerIfDown()
        guard await apiIsUp() else {
            log.error("Local server did not answer at \(self.api.absoluteString, privacy: .public)/up")
            error = "Couldn't reach the local server at \(api.absoluteString). Check that Docker is running (make up)."
            return
        }
        log.info("Local server is up; opening the workspace without sign-in")
        user = Login.User(name: "Local", email: nil)
        token = "local-development"
    }

    /// The first-launch answer. Local starts the servers on this Mac and signs in; cloud shows the normal sign-in.
    func choose(_ choice: ServerChoice) {
        log.info("Server choice: \(choice.rawValue, privacy: .public)")
        UserDefaults.standard.set(choice.rawValue, forKey: ServerChoice.defaultsKey)
        serverChoice = choice
        triedLocalSignIn = false
        Task { await signInIfLocal() }
    }

    /// Menu command: forget the choice, sign out and ask again.
    func chooseServerAgain() {
        UserDefaults.standard.removeObject(forKey: ServerChoice.defaultsKey)
        token = nil; user = nil; error = nil
        triedLocalSignIn = false
        serverChoice = nil
    }

    private func apiIsUp() async -> Bool {
        var request = URLRequest(url: api.appendingPathComponent("up"))
        request.timeoutInterval = 2
        guard let (_, response) = try? await URLSession.shared.data(for: request) else { return false }
        return (response as? HTTPURLResponse)?.statusCode == 200
    }

    /// A development build starts the local servers itself (`make up-d` in its checkout, which also starts
    /// Docker) when nothing answers. Returns true when it had to. Installed builds never do this.
    private func startLocalServerIfDown() async -> Bool {
        guard let root = LocalEndpoint.repositoryRoot(bundlePath: Bundle.main.bundlePath), !(await apiIsUp()) else { return false }
        log.info("Local server is down; running make up-d in \(root, privacy: .public)")
        startingServer = true
        defer { startingServer = false }
        let make = Process()
        make.executableURL = URL(fileURLWithPath: "/usr/bin/make")
        make.arguments = ["-C", root, "up-d"]
        // Apps opened from Finder get a minimal PATH that lacks Homebrew, where docker lives.
        var environment = ProcessInfo.processInfo.environment
        environment["PATH"] = "/opt/homebrew/bin:/usr/local/bin:" + (environment["PATH"] ?? "/usr/bin:/bin")
        make.environment = environment
        // make's own output goes to the log, one line at a time.
        let output = Pipe()
        let logger = log
        output.fileHandleForReading.readabilityHandler = { handle in
            let text = String(decoding: handle.availableData, as: UTF8.self)
            for line in text.split(whereSeparator: \.isNewline) { logger.info("make: \(String(line), privacy: .public)") }
        }
        make.standardOutput = output
        make.standardError = output
        await withCheckedContinuation { (done: CheckedContinuation<Void, Never>) in
            make.terminationHandler = { process in
                logger.info("make up-d exited with status \(process.terminationStatus)")
                done.resume()
            }
            do { try make.run() } catch {
                logger.error("Could not run make: \(error.localizedDescription, privacy: .public)")
                done.resume()
            }
        }
        output.fileHandleForReading.readabilityHandler = nil
        for _ in 0..<60 where !(await apiIsUp()) { try? await Task.sleep(nanoseconds: 2_000_000_000) }
        return true
    }

    func login(email: String, password: String) async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        do {
            let body = try JSONSerialization.data(withJSONObject: ["user": ["email": email, "password": password]])
            let (data, response) = try await URLSession.shared.data(for: Requests.make(base: api, path: "api/v1/auth/login", token: nil, method: "POST", body: body))
            let http = response as! HTTPURLResponse
            guard http.statusCode == 200 else { throw APIError.response(http.statusCode) }
            guard let bearer = Requests.bearerToken(http.value(forHTTPHeaderField: "Authorization")) else { throw APIError.missingToken }
            user = try JSONDecoder().decode(Login.self, from: data).user
            token = bearer
        } catch { self.error = error.localizedDescription }
    }
    /// Creates an account and signs in with it (the response carries the token, as login does).
    /// Returns the API's validation messages (taken email, short password) for the form to
    /// show inline; any other failure goes to `error`. An empty result means signed in, or
    /// that the call failed and `error` says why.
    func signUp(name: String, email: String, password: String) async -> [String] {
        guard !busy else { return [] }
        busy = true
        error = nil
        defer { busy = false }
        do {
            switch try await AuthClient(base: api).signUp(name: name, email: email, password: password) {
            case .signedIn(let bearer, let account): user = account; token = bearer
            case .invalid(let messages): return messages
            }
        } catch { self.error = error.localizedDescription }
        return []
    }
    func login(provider: String) async {
        guard !busy else { return }
        busy = true
        error = nil
        defer { busy = false }
        do {
            let (data, response) = try await socialSignIn.signIn(provider: provider, session: self)
            guard let bearer = Requests.bearerToken(response.value(forHTTPHeaderField: "Authorization")) else { throw APIError.missingToken }
            user = try JSONDecoder().decode(Login.self, from: data).user
            token = bearer
        } catch let error as ASWebAuthenticationSessionError where error.code == .canceledLogin {
            // Closing the provider sheet leaves the user on the login screen.
        } catch { self.error = error.localizedDescription }
    }
    func logout() async {
        if let token {
            _ = try? await URLSession.shared.data(for: Requests.make(base: api, path: "api/v1/auth/logout", token: token, method: "DELETE"))
        }
        token = nil; user = nil
    }
}
