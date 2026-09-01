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

    func testServesCriticalRuntimeMimeTypes() {
        XCTAssertEqual(LocalAssetResolver.mimeType(for: URL(fileURLWithPath: "mujoco.wasm")), "application/wasm")
        XCTAssertEqual(LocalAssetResolver.mimeType(for: URL(fileURLWithPath: "runtime.mjs")), "text/javascript")
        XCTAssertEqual(LocalAssetResolver.mimeType(for: URL(fileURLWithPath: "room.glb")), "model/gltf-binary")
        XCTAssertEqual(LocalAssetResolver.mimeType(for: URL(fileURLWithPath: "voice.wav")), "audio/wav")
    }
}
