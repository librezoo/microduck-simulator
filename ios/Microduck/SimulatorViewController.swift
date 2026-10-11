import OSLog
import UIKit
import WebKit

enum SimulatorNavigationPolicy {
    static func isTrustedAppDocument(_ url: URL) -> Bool {
        url.scheme?.lowercased() == "microduck"
            && url.host?.lowercased() == "app"
            && url.port == nil
            && url.user == nil
            && url.password == nil
            && url.path == "/index.html"
    }

    static func allowsNavigation(to url: URL, targetIsMainFrame: Bool?) -> Bool {
        switch targetIsMainFrame {
        case true:
            // Query items carry native boot options, but the origin and
            // document path must remain exactly the bundled entry point.
            return isTrustedAppDocument(url)
        case false:
            return url.absoluteString == "about:blank" || url.scheme?.lowercased() == "blob"
        case nil:
            // A nil target represents a new window, not a subframe.
            return false
        }
    }

    static func isExternalWebURL(_ url: URL) -> Bool {
        url.scheme?.lowercased() == "https"
    }

    static func isTrustedBridgeSource(
        documentURL: URL,
        originProtocol: String,
        originHost: String,
        originPort: Int
    ) -> Bool {
        isTrustedAppDocument(documentURL)
            && originProtocol == "microduck"
            && originHost == "app"
            && originPort == 0
    }
}

struct SimulatorRecoveryCoordinator {
    enum State: Equatable {
        case healthy
        case waitingForActive(reason: String, attemptsUsed: Int)
        case waitingForRetry(reason: String, attempt: Int)
        case recovering(reason: String, attempt: Int)
        case failed(reason: String)
    }

    enum Event: Equatable {
        case failure(String)
        case becameInactive
        case becameActive
        case retryTimerFired
        case booted
        case manualRetry
    }

    enum Action: Equatable {
        case none
        case scheduleRetry(milliseconds: Int)
        case reload
        case stopLoading
        case showFinalError(reason: String)
    }

    private static let retryDelays = [250, 750, 1_500]
    private(set) var state: State = .healthy

    mutating func handle(_ event: Event, isActive: Bool) -> Action {
        switch event {
        case .failure(let reason):
            switch state {
            case .healthy:
                return queueRetry(reason: reason, attemptsUsed: 0, isActive: isActive)
            case .waitingForActive(_, let attemptsUsed):
                return queueRetry(reason: reason, attemptsUsed: attemptsUsed, isActive: isActive)
            case .waitingForRetry(_, let attempt):
                if isActive {
                    state = .waitingForRetry(reason: reason, attempt: attempt)
                } else {
                    state = .waitingForActive(reason: reason, attemptsUsed: attempt - 1)
                }
                return .none
            case .recovering(_, let attempt):
                return queueRetry(reason: reason, attemptsUsed: attempt, isActive: isActive)
            case .failed:
                state = .failed(reason: reason)
                return .showFinalError(reason: reason)
            }

        case .becameInactive:
            switch state {
            case .waitingForRetry(let reason, let attempt):
                state = .waitingForActive(reason: reason, attemptsUsed: attempt - 1)
            case .recovering(let reason, let attempt):
                state = .waitingForActive(reason: reason, attemptsUsed: attempt - 1)
                return .stopLoading
            default:
                break
            }
            return .none

        case .becameActive:
            guard case .waitingForActive(let reason, let attemptsUsed) = state else {
                if case .failed(let reason) = state {
                    return .showFinalError(reason: reason)
                }
                return .none
            }
            return queueRetry(reason: reason, attemptsUsed: attemptsUsed, isActive: isActive)

        case .retryTimerFired:
            guard case .waitingForRetry(let reason, let attempt) = state else { return .none }
            guard isActive else {
                state = .waitingForActive(reason: reason, attemptsUsed: attempt - 1)
                return .none
            }
            state = .recovering(reason: reason, attempt: attempt)
            return .reload

        case .booted:
            state = .healthy
            return .none

        case .manualRetry:
            let reason: String
            switch state {
            case .failed(let previousReason),
                 .waitingForActive(let previousReason, _),
                 .waitingForRetry(let previousReason, _),
                 .recovering(let previousReason, _):
                reason = previousReason
            case .healthy:
                reason = "Simulator recovery requested"
            }
            return queueRetry(reason: reason, attemptsUsed: 0, isActive: isActive)
        }
    }

    private mutating func queueRetry(
        reason: String,
        attemptsUsed: Int,
        isActive: Bool
    ) -> Action {
        guard isActive else {
            state = .waitingForActive(reason: reason, attemptsUsed: attemptsUsed)
            return .none
        }
        guard attemptsUsed < Self.retryDelays.count else {
            state = .failed(reason: reason)
            return .showFinalError(reason: reason)
        }
        let attempt = attemptsUsed + 1
        state = .waitingForRetry(reason: reason, attempt: attempt)
        return .scheduleRetry(milliseconds: Self.retryDelays[attempt - 1])
    }
}

@MainActor
final class SimulatorViewController: UIViewController {
    private static let logger = Logger(subsystem: "com.librezoo.microduck", category: "simulator")
    private let performance: PerformanceController
    private var webView: WKWebView!
    private var schemeHandler: LocalAssetSchemeHandler!
    private var scriptMessageProxy: WeakScriptMessageHandler!
    private var recovery = SimulatorRecoveryCoordinator()
    private var recoveryTask: Task<Void, Never>?
    private weak var recoveryAlert: UIAlertController?

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
            self?.transitionRecovery(.becameActive)
        }
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(applicationWillResignActive),
            name: UIApplication.willResignActiveNotification,
            object: nil
        )
        loadSimulator()
    }

    deinit {
        recoveryTask?.cancel()
        NotificationCenter.default.removeObserver(self)
    }

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .bottom }

    @objc private func applicationWillResignActive() {
        transitionRecovery(.becameInactive)
    }

    private func loadSimulator() {
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

    private func transitionRecovery(_ event: SimulatorRecoveryCoordinator.Event) {
        let isActive: Bool
        switch event {
        case .becameActive:
            isActive = true
        case .becameInactive:
            isActive = false
        default:
            isActive = UIApplication.shared.applicationState == .active
        }
        if !isActive || event == .booted {
            recoveryTask?.cancel()
            recoveryTask = nil
        }

        let action = recovery.handle(event, isActive: isActive)
        switch action {
        case .none:
            break
        case .scheduleRetry(let delayMilliseconds):
            guard recoveryTask == nil else { return }
            Self.logger.error("Scheduling simulator recovery in \(delayMilliseconds) ms")
            recoveryTask = Task { @MainActor [weak self] in
                do {
                    try await Task.sleep(for: .milliseconds(delayMilliseconds))
                } catch {
                    return
                }
                guard !Task.isCancelled, let self else { return }
                self.recoveryTask = nil
                self.transitionRecovery(.retryTimerFired)
            }
        case .reload:
            Self.logger.error("Reloading the offline simulator after a recoverable failure")
            webView.stopLoading()
            loadSimulator()
        case .stopLoading:
            Self.logger.notice("Suspending an in-progress simulator recovery")
            webView.stopLoading()
        case .showFinalError(let reason):
            Self.logger.fault("Simulator recovery exhausted: \(reason, privacy: .public)")
            showRecoveryAlert(reason: reason)
        }
    }

    private func showRecoveryAlert(reason: String) {
        guard presentedViewController == nil else { return }
        let alert = UIAlertController(
            title: "Zoo Kinder paused",
            message: "\(reason). The simulator could not recover automatically.",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "Retry", style: .default) { [weak self] _ in
            guard let self else { return }
            self.transitionRecovery(.manualRetry)
        })
        recoveryAlert = alert
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
            SimulatorNavigationPolicy.isTrustedBridgeSource(
                documentURL: sourceURL,
                originProtocol: message.frameInfo.securityOrigin.protocol,
                originHost: message.frameInfo.securityOrigin.host,
                originPort: message.frameInfo.securityOrigin.port
            ),
            let body = message.body as? [String: Any],
            let type = body["type"] as? String
        else { return }

        switch type {
        case "ready":
            Self.logger.notice("Native bridge ready")
            performance.pushState(force: true)
        case "booted":
            Self.logger.notice("Offline simulator boot completed")
            transitionRecovery(.booted)
        case "boot-failed":
            Self.logger.error("Web simulator boot failed: \(String(describing: body["detail"]))")
            transitionRecovery(.failure("Web simulator boot failed"))
        case "webgl-context-lost":
            transitionRecovery(.failure("WebGL context lost"))
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
        if SimulatorNavigationPolicy.allowsNavigation(
            to: url,
            targetIsMainFrame: navigationAction.targetFrame?.isMainFrame
        ) {
            decisionHandler(.allow)
            return
        }
        if isTrustedExternalLink(navigationAction), SimulatorNavigationPolicy.isExternalWebURL(url) {
            UIApplication.shared.open(url)
        }
        decisionHandler(.cancel)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        transitionRecovery(.failure("Web content process terminated"))
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: any Error
    ) {
        handleNavigationFailure(error)
    }

    func webView(
        _ webView: WKWebView,
        didFail navigation: WKNavigation!,
        withError error: any Error
    ) {
        handleNavigationFailure(error)
    }

    private func handleNavigationFailure(_ error: any Error) {
        if (error as? URLError)?.code == .cancelled { return }
        transitionRecovery(.failure("Offline simulator navigation failed"))
    }

    private func isTrustedExternalLink(_ navigationAction: WKNavigationAction) -> Bool {
        navigationAction.navigationType == .linkActivated
            && navigationAction.sourceFrame.isMainFrame
            && navigationAction.sourceFrame.request.url.map(
                SimulatorNavigationPolicy.isTrustedAppDocument
            ) == true
    }
}

extension SimulatorViewController: WKUIDelegate {
    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if navigationAction.navigationType == .linkActivated,
           navigationAction.sourceFrame.isMainFrame,
           navigationAction.sourceFrame.request.url.map(
               SimulatorNavigationPolicy.isTrustedAppDocument
           ) == true,
           let url = navigationAction.request.url,
           SimulatorNavigationPolicy.isExternalWebURL(url) {
            UIApplication.shared.open(url)
        }
        return nil
    }
}
