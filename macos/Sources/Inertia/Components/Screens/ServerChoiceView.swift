import SwiftUI
import InertiaCore

// Shown once on a development build's first launch (and from the app menu): run the servers on this Mac,
// or use the hosted app. The answer is remembered; see `Session.choose`.
struct ServerChoiceView: View {
    @EnvironmentObject private var session: Session

    var body: some View {
        VStack(spacing: 16) {
            VStack(spacing: 8) {
                AppLogo()
                Text("Where should Inertia run?").voltaFont(.twoXL, weight: .semibold).tracking(-0.6).foregroundStyle(Volta.foreground)
                Text("You can change this later from the Inertia menu.").voltaFont(.sm).foregroundStyle(Volta.mutedForeground)
            }
            choice("Local", detail: "Runs the server on this Mac. No sign-in. Needs Docker.", variant: .primary, value: .local)
            choice("Cloud", detail: "Uses inertia.it.com and needs you to sign in.", variant: .secondary, value: .cloud)
        }.voltaAuthCard()
    }

    private func choice(_ title: String, detail: String, variant: VoltaVariant, value: ServerChoice) -> some View {
        VStack(spacing: 4) {
            Button(title) { session.choose(value) }.buttonStyle(.volta(variant, fullWidth: true))
            Text(detail).voltaMuted(.xs).multilineTextAlignment(.center)
        }
    }
}
