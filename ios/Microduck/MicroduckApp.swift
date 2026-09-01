import SwiftUI

@main
struct MicroduckApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var performance = PerformanceController()

    var body: some Scene {
        WindowGroup {
            SimulatorView(performance: performance)
                .ignoresSafeArea()
                .background(Color(red: 8 / 255, green: 8 / 255, blue: 12 / 255))
                .onChange(of: scenePhase, initial: true) { _, phase in
                    performance.setAppActive(phase == .active)
                }
        }
    }
}
