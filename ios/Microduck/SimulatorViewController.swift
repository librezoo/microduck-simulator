import OSLog
import UIKit
import WebKit

@MainActor
final class SimulatorViewController: UIViewController {
    private static let logger = Logger(subsystem: "zoo.micro.microduck", category: "simulator")
    private let performance: PerformanceController
    private var webView: WKWebView!
    private var schemeHandler: LocalAssetSchemeHandler!
    private var scriptMessageProxy: WeakScriptMessageHandler!
    private var deferredRecoveryReason: String?
    private var recoveryWindowStartedAt = Date.distantPast
    private var automaticRecoveryAttempts = 0
    private var recoveryTask: Task<Void, Never>?

    init(performance: PerformanceController) {
        self.performance = performance
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 8 / 255, green: 8 / 255, blue: 12 / 255, alpha: 1)

        guard let resourceRoot = Bundle.main.resourceURL?.appendingPathComponent("Web") else {
            Self.logger.fault("Offline web bundle is missing")
            return
        }

        let configuration = WKWebViewConfiguration()
        schemeHandler = LocalAssetSchemeHandler(root: resourceRoot)
        configuration.setURLSchemeHandler(schemeHandler, forURLScheme: "microduck")
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.userContentController.addUserScript(
            WKUserScript(
                source: performance.bootstrapJavaScript,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
        )
        scriptMessageProxy = WeakScriptMessageHandler(delegate: self)
        configuration.userContentController.add(scriptMessageProxy, name: "microduck")

        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.isOpaque = true
        webView.backgroundColor = view.backgroundColor
        webView.scrollView.backgroundColor = view.backgroundColor
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.isScrollEnabled = false
        webView.allowsBackForwardNavigationGestures = false
#if DEBUG
        if #available(iOS 16.4, *) { webView.isInspectable = true }
#endif

        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        performance.attach(to: webView)
        performance.onBecameActive = { [weak self] in
            guard let self, let reason = self.deferredRecoveryReason else { return }
            self.deferredRecoveryReason = nil
            self.scheduleRecovery(reason: reason)
        }
        loadSimulator()
    }

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .bottom }

    private func loadSimulator() {
        deferredRecoveryReason = nil
        var components = URLComponents()
        components.scheme = "microduck"
        components.host = "app"
        components.path = "/index.html"
        var queryItems = [
            URLQueryItem(name: "native", value: "1"),
            URLQueryItem(name: "touch", value: "1"),
        ]
#if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--microduck-boot-direct") {
            queryItems.append(URLQueryItem(name: "boot", value: "1"))
        }
#endif
        components.queryItems = queryItems
        guard let url = components.url else { return }
        webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData))
    }

    private func scheduleRecovery(reason: String) {
        guard UIApplication.shared.applicationState == .active else {
            Self.logger.error("\(reason, privacy: .public) in background; deferring recovery")
            deferredRecoveryReason = reason
            return
        }
        guard recoveryTask == nil else { return }

        let now = Date()
        if now.timeIntervalSince(recoveryWindowStartedAt) > 60 {
            recoveryWindowStartedAt = now
            automaticRecoveryAttempts = 0
        }
        guard automaticRecoveryAttempts < 3 else {
            showRecoveryAlert(reason: reason)
            return
        }

        automaticRecoveryAttempts += 1
        let delayMilliseconds = [250, 750, 1_500][automaticRecoveryAttempts - 1]
        Self.logger.error(
            "\(reason, privacy: .public); recovery attempt \(self.automaticRecoveryAttempts)"
        )
        recoveryTask = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(delayMilliseconds) * 1_000_000)
            guard !Task.isCancelled, let self else { return }
            self.recoveryTask = nil
            if UIApplication.shared.applicationState == .active {
                self.loadSimulator()
            } else {
                self.deferredRecoveryReason = reason
            }
        }
    }

    private func showRecoveryAlert(reason: String) {
        guard presentedViewController == nil else { return }
        let alert = UIAlertController(
            title: "Microduck paused",
            message: "\(reason). The simulator could not recover automatically.",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "Retry", style: .default) { [weak self] _ in
            guard let self else { return }
            self.automaticRecoveryAttempts = 0
            self.recoveryWindowStartedAt = .distantPast
            self.loadSimulator()
        })
        present(alert, animated: true)
    }
}

@MainActor
private final class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler {
    weak var delegate: (any WKScriptMessageHandler)?

    init(delegate: any WKScriptMessageHandler) {
        self.delegate = delegate
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        delegate?.userContentController(userContentController, didReceive: message)
    }
}

extension SimulatorViewController: WKScriptMessageHandler {
    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard
            message.name == "microduck",
            message.frameInfo.isMainFrame,
            let sourceURL = message.frameInfo.request.url,
            sourceURL.scheme == "microduck",
            sourceURL.host == "app",
            sourceURL.path == "/index.html",
            let body = message.body as? [String: Any],
            let type = body["type"] as? String
        else { return }

        switch type {
        case "ready":
            Self.logger.notice("Native bridge ready")
            performance.pushState(force: true)
        case "booted":
            Self.logger.notice("Offline simulator boot completed")
            recoveryTask?.cancel()
            recoveryTask = nil
            automaticRecoveryAttempts = 0
            recoveryWindowStartedAt = .distantPast
        case "boot-failed":
            Self.logger.error("Web simulator boot failed: \(String(describing: body["detail"]))")
        case "webgl-context-lost":
            scheduleRecovery(reason: "WebGL context lost")
        default:
            break
        }
    }
}

extension SimulatorViewController: WKNavigationDelegate {
    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        if url.scheme == "microduck", url.host == "app", url.path == "/index.html" {
            decisionHandler(.allow)
            return
        }
        if url.absoluteString == "about:blank" {
            decisionHandler(.allow)
            return
        }
        if navigationAction.navigationType == .linkActivated,
           url.scheme == "https" || url.scheme == "http" {
            UIApplication.shared.open(url)
        }
        decisionHandler(.cancel)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        scheduleRecovery(reason: "Web content process terminated")
    }
}

extension SimulatorViewController: WKUIDelegate {
    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if let url = navigationAction.request.url,
           url.scheme == "https" || url.scheme == "http" {
            UIApplication.shared.open(url)
        }
        return nil
    }
}
