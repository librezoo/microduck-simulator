import SwiftUI

struct SimulatorView: UIViewControllerRepresentable {
    let performance: PerformanceController

    func makeUIViewController(context: Context) -> SimulatorViewController {
        SimulatorViewController(performance: performance)
    }

    func updateUIViewController(_ controller: SimulatorViewController, context: Context) {}
}
