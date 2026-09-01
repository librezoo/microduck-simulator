import Combine
import Foundation
import UIKit
import WebKit

@MainActor
final class PerformanceController: NSObject, ObservableObject {
    private weak var webView: WKWebView?
    private var appActive = true
    private var lastPayload = ""
    var onBecameActive: (() -> Void)?

    override init() {
        super.init()
        appActive = UIApplication.shared.applicationState == .active
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(systemStateDidChange),
            name: ProcessInfo.thermalStateDidChangeNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(systemStateDidChange),
            name: .NSProcessInfoPowerStateDidChange,
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    func attach(to webView: WKWebView) {
        self.webView = webView
    }

    func setAppActive(_ active: Bool) {
        guard appActive != active else { return }
        appActive = active
        pushState(force: true)
        if active { onBecameActive?() }
    }

    var bootstrapJavaScript: String {
        "window.__MICRODUCK_NATIVE__ = \(payloadJSON());"
    }

    func pushState(force: Bool = false) {
        let payload = payloadJSON()
        guard force || payload != lastPayload else { return }
        lastPayload = payload
        webView?.evaluateJavaScript("window.__microduckNativeUpdate?.(\(payload));")
    }

    @objc private func systemStateDidChange() {
        pushState(force: true)
    }

    private func payloadJSON() -> String {
        let payload: [String: Any] = [
            "enabled": true,
            "thermalState": thermalStateName,
            "lowPowerMode": ProcessInfo.processInfo.isLowPowerModeEnabled,
            "appActive": appActive,
        ]
        guard
            let data = try? JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys]),
            let json = String(data: data, encoding: .utf8)
        else {
            return "{\"enabled\":true}"
        }
        return json
    }

    private var thermalStateName: String {
        switch ProcessInfo.processInfo.thermalState {
        case .nominal: "nominal"
        case .fair: "fair"
        case .serious: "serious"
        case .critical: "critical"
        @unknown default: "serious"
        }
    }
}
