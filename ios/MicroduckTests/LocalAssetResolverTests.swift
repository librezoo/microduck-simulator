import XCTest
@testable import Microduck

final class LocalAssetResolverTests: XCTestCase {
    func testResolvesOnlyFilesBelowBundleRoot() throws {
        let root = URL(fileURLWithPath: "/tmp/MicroduckWeb", isDirectory: true)
        let valid = try XCTUnwrap(URL(string: "microduck://app/bundle/index.js"))
        XCTAssertEqual(
            LocalAssetResolver.resolve(valid, below: root)?.path,
            "/tmp/MicroduckWeb/bundle/index.js"
        )

        let traversal = try XCTUnwrap(URL(string: "microduck://app/%2E%2E/Info.plist"))
        XCTAssertNil(LocalAssetResolver.resolve(traversal, below: root))
        let wrongHost = try XCTUnwrap(URL(string: "microduck://remote/index.html"))
        XCTAssertNil(LocalAssetResolver.resolve(wrongHost, below: root))
    }

    func testParsesAudioByteRanges() {
        XCTAssertEqual(LocalAssetResolver.parseRange("bytes=10-19", fileSize: 100), 10..<20)
        XCTAssertEqual(LocalAssetResolver.parseRange("bytes=90-", fileSize: 100), 90..<100)
        XCTAssertEqual(LocalAssetResolver.parseRange("bytes=-10", fileSize: 100), 90..<100)
        XCTAssertNil(LocalAssetResolver.parseRange("bytes=100-101", fileSize: 100))
        XCTAssertNil(LocalAssetResolver.parseRange("bytes=0-1,5-6", fileSize: 100))
    }

    func testIgnoresOnlySyntacticallyValidUnsupportedMultiRanges() {
        XCTAssertEqual(
            LocalAssetResolver.selectRange("bytes=0-1, 5-6", fileSize: 100),
            .fullResponse
        )
        XCTAssertEqual(
            LocalAssetResolver.selectRange("bytes=100-120, 200-220", fileSize: 100),
            .fullResponse
        )
        XCTAssertEqual(
            LocalAssetResolver.selectRange("bytes=0-1, nope", fileSize: 100),
            .unsatisfiable
        )
        XCTAssertEqual(
            LocalAssetResolver.selectRange("bytes=100-120", fileSize: 100),
            .unsatisfiable
        )
    }

    func testMultiRangeLoadFallsBackToFullResponse() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(
            UUID().uuidString,
            isDirectory: true
        )
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let contents = Data("0123456789".utf8)
        try contents.write(to: root.appendingPathComponent("media.bin"))

        var request = URLRequest(
            url: try XCTUnwrap(URL(string: "microduck://app/media.bin"))
        )
        request.setValue("bytes=0-1, 5-6", forHTTPHeaderField: "Range")
        let payload = try LocalAssetSchemeHandler.load(request, root: root) { false }

        XCTAssertEqual(payload.statusCode, 200)
        XCTAssertEqual(payload.data, contents)
        XCTAssertNil(payload.headers["Content-Range"])
    }

    func testAssetLoadChecksCancellationBeforeReading() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(
            UUID().uuidString,
            isDirectory: true
        )
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        try Data(repeating: 7, count: 1_024).write(to: root.appendingPathComponent("asset.bin"))
        let request = URLRequest(
            url: try XCTUnwrap(URL(string: "microduck://app/asset.bin"))
        )

        XCTAssertThrowsError(try LocalAssetSchemeHandler.load(request, root: root) { true }) { error in
            XCTAssertEqual((error as? URLError)?.code, .cancelled)
        }
    }

    func testStoppingSchemeTaskCancelsItsOperation() {
        let state = SchemeTaskState()
        let owner = NSObject()
        let identifier = ObjectIdentifier(owner)
        let operation = BlockOperation {}

        state.register(identifier)
        state.attach(operation, to: identifier)
        XCTAssertTrue(state.shouldContinue(identifier))

        state.cancel(identifier)
        XCTAssertTrue(operation.isCancelled)
        XCTAssertFalse(state.shouldContinue(identifier))
    }

    func testCancellationBeforeQueueAttachmentCancelsLateOperation() {
        let state = SchemeTaskState()
        let owner = NSObject()
        let identifier = ObjectIdentifier(owner)
        let operation = BlockOperation {}

        state.register(identifier)
        state.cancel(identifier)
        state.attach(operation, to: identifier)

        XCTAssertTrue(operation.isCancelled)
        XCTAssertFalse(state.shouldContinue(identifier))
    }

    func testServesCriticalRuntimeMimeTypes() {
        XCTAssertEqual(LocalAssetResolver.mimeType(for: URL(fileURLWithPath: "mujoco.wasm")), "application/wasm")
        XCTAssertEqual(LocalAssetResolver.mimeType(for: URL(fileURLWithPath: "runtime.mjs")), "text/javascript")
        XCTAssertEqual(LocalAssetResolver.mimeType(for: URL(fileURLWithPath: "room.glb")), "model/gltf-binary")
        XCTAssertEqual(LocalAssetResolver.mimeType(for: URL(fileURLWithPath: "voice.wav")), "audio/wav")
    }
}

final class SimulatorNavigationPolicyTests: XCTestCase {
    func testMainFrameAllowsOnlyBundledEntryDocument() throws {
        let entry = try XCTUnwrap(URL(string: "microduck://app/index.html?native=1&touch=1"))
        XCTAssertTrue(
            SimulatorNavigationPolicy.allowsNavigation(to: entry, targetIsMainFrame: true)
        )

        let cases = [
            "microduck://app/other.html",
            "microduck://remote/index.html",
            "microduck://app:123/index.html",
            "about:blank",
            "blob:microduck://app/example",
            "https://example.com/",
        ]
        for value in cases {
            let url = try XCTUnwrap(URL(string: value))
            XCTAssertFalse(
                SimulatorNavigationPolicy.allowsNavigation(to: url, targetIsMainFrame: true),
                value
            )
        }
    }

    func testBlankAndBlobDocumentsAreLimitedToExistingSubframes() throws {
        let blank = try XCTUnwrap(URL(string: "about:blank"))
        let blob = try XCTUnwrap(URL(string: "blob:microduck://app/example"))

        XCTAssertTrue(
            SimulatorNavigationPolicy.allowsNavigation(to: blank, targetIsMainFrame: false)
        )
        XCTAssertTrue(
            SimulatorNavigationPolicy.allowsNavigation(to: blob, targetIsMainFrame: false)
        )
        XCTAssertFalse(
            SimulatorNavigationPolicy.allowsNavigation(to: blank, targetIsMainFrame: nil)
        )
        XCTAssertFalse(
            SimulatorNavigationPolicy.allowsNavigation(to: blob, targetIsMainFrame: nil)
        )
    }

    func testBridgeRequiresMatchingDocumentAndSecurityOrigin() throws {
        let entry = try XCTUnwrap(URL(string: "microduck://app/index.html?native=1"))
        XCTAssertTrue(
            SimulatorNavigationPolicy.isTrustedBridgeSource(
                documentURL: entry,
                originProtocol: "microduck",
                originHost: "app",
                originPort: 0
            )
        )
        XCTAssertFalse(
            SimulatorNavigationPolicy.isTrustedBridgeSource(
                documentURL: entry,
                originProtocol: "https",
                originHost: "app",
                originPort: 0
            )
        )
        XCTAssertFalse(
            SimulatorNavigationPolicy.isTrustedBridgeSource(
                documentURL: entry,
                originProtocol: "microduck",
                originHost: "remote",
                originPort: 0
            )
        )
        XCTAssertFalse(
            SimulatorNavigationPolicy.isTrustedBridgeSource(
                documentURL: entry,
                originProtocol: "microduck",
                originHost: "app",
                originPort: 443
            )
        )
    }

    func testExternalNavigationAllowsHTTPSOnly() throws {
        XCTAssertTrue(
            SimulatorNavigationPolicy.isExternalWebURL(
                try XCTUnwrap(URL(string: "https://example.com/path"))
            )
        )
        for value in ["http://example.com/", "file:///tmp/example", "javascript:alert(1)"] {
            XCTAssertFalse(
                SimulatorNavigationPolicy.isExternalWebURL(try XCTUnwrap(URL(string: value))),
                value
            )
        }
    }
}

final class SimulatorRecoveryCoordinatorTests: XCTestCase {
    func testBackgroundFailureWaitsForActiveBeforeScheduling() {
        var recovery = SimulatorRecoveryCoordinator()

        XCTAssertEqual(recovery.handle(.failure("WebGL lost"), isActive: false), .none)
        XCTAssertEqual(
            recovery.state,
            .waitingForActive(reason: "WebGL lost", attemptsUsed: 0)
        )
        XCTAssertEqual(
            recovery.handle(.becameActive, isActive: true),
            .scheduleRetry(milliseconds: 250)
        )
        XCTAssertEqual(recovery.handle(.retryTimerFired, isActive: true), .reload)
    }

    func testBackgroundingDuringBackoffDoesNotConsumeAttempt() {
        var recovery = SimulatorRecoveryCoordinator()

        XCTAssertEqual(
            recovery.handle(.failure("Process terminated"), isActive: true),
            .scheduleRetry(milliseconds: 250)
        )
        XCTAssertEqual(recovery.handle(.becameInactive, isActive: false), .none)
        XCTAssertEqual(
            recovery.state,
            .waitingForActive(reason: "Process terminated", attemptsUsed: 0)
        )
        XCTAssertEqual(
            recovery.handle(.becameActive, isActive: true),
            .scheduleRetry(milliseconds: 250)
        )
    }

    func testBackgroundingDuringRecoveryStopsLoadAndRetriesSameAttemptLater() {
        var recovery = SimulatorRecoveryCoordinator()

        XCTAssertEqual(
            recovery.handle(.failure("Process terminated"), isActive: true),
            .scheduleRetry(milliseconds: 250)
        )
        XCTAssertEqual(recovery.handle(.retryTimerFired, isActive: true), .reload)
        XCTAssertEqual(recovery.handle(.becameInactive, isActive: false), .stopLoading)
        XCTAssertEqual(
            recovery.state,
            .waitingForActive(reason: "Process terminated", attemptsUsed: 0)
        )
        XCTAssertEqual(
            recovery.handle(.becameActive, isActive: true),
            .scheduleRetry(milliseconds: 250)
        )
    }

    func testRecoveryExhaustsAfterThreeReloadsUntilBootOrManualRetry() {
        var recovery = SimulatorRecoveryCoordinator()

        XCTAssertEqual(
            recovery.handle(.failure("Failure 1"), isActive: true),
            .scheduleRetry(milliseconds: 250)
        )
        XCTAssertEqual(recovery.handle(.retryTimerFired, isActive: true), .reload)
        XCTAssertEqual(
            recovery.handle(.failure("Failure 2"), isActive: true),
            .scheduleRetry(milliseconds: 750)
        )
        XCTAssertEqual(recovery.handle(.retryTimerFired, isActive: true), .reload)
        XCTAssertEqual(
            recovery.handle(.failure("Failure 3"), isActive: true),
            .scheduleRetry(milliseconds: 1_500)
        )
        XCTAssertEqual(recovery.handle(.retryTimerFired, isActive: true), .reload)
        XCTAssertEqual(
            recovery.handle(.failure("Still failing"), isActive: true),
            .showFinalError(reason: "Still failing")
        )
        XCTAssertEqual(recovery.state, .failed(reason: "Still failing"))

        XCTAssertEqual(
            recovery.handle(.manualRetry, isActive: true),
            .scheduleRetry(milliseconds: 250)
        )
        XCTAssertEqual(recovery.handle(.booted, isActive: true), .none)
        XCTAssertEqual(recovery.state, .healthy)
    }
}
