import SwiftUI
import InertiaCore
import AuthenticationServices

@MainActor final class Session: ObservableObject {
    // Production by default; INERTIA_API_URL and INERTIA_WEB_URL override both endpoints, and a
    // development build (build/Inertia.app) defaults to the local servers.
    private static let developmentBuild = LocalEndpoint.isDevelopmentBuild(bundlePath: Bundle.main.bundlePath)
    let api = URL(string: ProcessInfo.processInfo.environment["INERTIA_API_URL"]
        ?? (developmentBuild ? LocalEndpoint.developmentAPI : "https://inertia.it.com"))!
    let web = URL(string: ProcessInfo.processInfo.environment["INERTIA_WEB_URL"]
        ?? (developmentBuild ? LocalEndpoint.developmentWeb : "https://inertia.it.com"))!
    @Published var token: String?
    @Published var user: Login.User?
    @Published var error: String?
    @Published var busy = false
    private let socialSignIn = SocialSignIn()
    private var triedLocalSignIn = false

    /// Against a local API the app skips the sign-in screen by signing in as the seeded development
    /// user (the API accepts admin/admin only in its development environment). Once per launch, so
    /// signing out still reaches the sign-in screen, and a failure leaves that screen without an alert.
    func signInIfLocal() async {
        guard token == nil, !triedLocalSignIn, LocalEndpoint.isLocal(api) else { return }
        triedLocalSignIn = true
        await login(email: "admin", password: "admin")
        error = nil
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
