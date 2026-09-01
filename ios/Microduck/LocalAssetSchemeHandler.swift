import Foundation
import UniformTypeIdentifiers
import WebKit

enum LocalAssetResolver {
    static func resolve(_ url: URL, below root: URL) -> URL? {
        guard url.host == "app", let decoded = url.path.removingPercentEncoding else { return nil }
        let components = decoded.split(separator: "/", omittingEmptySubsequences: true)
        guard !components.isEmpty, components.allSatisfy({ $0 != "." && $0 != ".." }) else {
            return nil
        }
        var candidate = root
        for component in components {
            candidate.appendPathComponent(String(component), isDirectory: false)
        }
        let rootPath = root.resolvingSymlinksInPath().standardizedFileURL.path
        let candidateURL = candidate.resolvingSymlinksInPath().standardizedFileURL
        guard candidateURL.path.hasPrefix(rootPath + "/") else { return nil }
        return candidateURL
    }

    static func parseRange(_ header: String, fileSize: Int) -> Range<Int>? {
        guard fileSize > 0, header.lowercased().hasPrefix("bytes=") else { return nil }
        let value = header.dropFirst(6)
        guard !value.contains(","), let dash = value.firstIndex(of: "-") else { return nil }
        let lowerText = value[..<dash]
        let upperText = value[value.index(after: dash)...]

        if lowerText.isEmpty {
            guard let suffix = Int(upperText), suffix > 0 else { return nil }
            let count = min(suffix, fileSize)
            return (fileSize - count)..<fileSize
        }

        guard let lower = Int(lowerText), lower >= 0, lower < fileSize else { return nil }
        let upperInclusive = upperText.isEmpty ? fileSize - 1 : min(Int(upperText) ?? -1, fileSize - 1)
        guard upperInclusive >= lower else { return nil }
        return lower..<(upperInclusive + 1)
    }

    static func mimeType(for fileURL: URL) -> String {
        switch fileURL.pathExtension.lowercased() {
        case "html": "text/html"
        case "js", "mjs": "text/javascript"
        case "css": "text/css"
        case "wasm": "application/wasm"
        case "json": "application/json"
        case "xml": "application/xml"
        case "csv": "text/csv"
        case "yaml", "yml": "application/yaml"
        case "svg": "image/svg+xml"
        case "webp": "image/webp"
        case "png": "image/png"
        case "glb": "model/gltf-binary"
        case "stl": "model/stl"
        case "onnx": "application/octet-stream"
        case "mp3": "audio/mpeg"
        case "wav": "audio/wav"
        case "woff": "font/woff"
        case "woff2": "font/woff2"
        default:
            UTType(filenameExtension: fileURL.pathExtension)?.preferredMIMEType
                ?? "application/octet-stream"
        }
    }
}

final class LocalAssetSchemeHandler: NSObject, WKURLSchemeHandler {
    private let root: URL
    private let loadingQueue: OperationQueue = {
        let queue = OperationQueue()
        queue.name = "zoo.micro.microduck.assets"
        queue.qualityOfService = .userInitiated
        queue.maxConcurrentOperationCount = 4
        return queue
    }()
    private let taskState = SchemeTaskState()

    init(root: URL) {
        self.root = root
        super.init()
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: any WKURLSchemeTask) {
        let box = SchemeTaskBox(urlSchemeTask)
        taskState.register(box.id)
        let root = root
        let state = taskState
        let operation = BlockOperation {
            guard state.isActive(box.id) else { return }
            let result = Result {
                try Self.load(box.request, root: root) {
                    !state.isActive(box.id)
                }
            }
            guard state.isActive(box.id) else { return }
            OperationQueue.main.addOperation {
                guard state.finish(box.id) else { return }
                switch result {
                case .success(let payload):
                    guard let response = HTTPURLResponse(
                        url: payload.url,
                        statusCode: payload.statusCode,
                        httpVersion: "HTTP/1.1",
                        headerFields: payload.headers
                    ) else {
                        box.task.didFailWithError(URLError(.badServerResponse))
                        return
                    }
                    box.task.didReceive(response)
                    if !payload.data.isEmpty { box.task.didReceive(payload.data) }
                    box.task.didFinish()
                case .failure(let error):
                    box.task.didFailWithError(error)
                }
            }
        }
        taskState.attach(operation, to: box.id)
        loadingQueue.addOperation(operation)
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: any WKURLSchemeTask) {
        taskState.cancel(ObjectIdentifier(urlSchemeTask as AnyObject))
    }

    nonisolated private static func load(
        _ request: URLRequest,
        root: URL,
        isCancelled: @Sendable () -> Bool
    ) throws -> AssetPayload {
        guard
            let url = request.url,
            let fileURL = LocalAssetResolver.resolve(url, below: root),
            FileManager.default.fileExists(atPath: fileURL.path),
            let attributes = try? FileManager.default.attributesOfItem(atPath: fileURL.path),
            let sizeNumber = attributes[.size] as? NSNumber
        else {
            throw URLError(.fileDoesNotExist)
        }

        let fileSize = sizeNumber.intValue
        let requestedRange = request.value(forHTTPHeaderField: "Range")
        let byteRange: Range<Int>
        let statusCode: Int
        if let requestedRange, requestedRange.contains(",") {
            // Multipart byte ranges add substantial response machinery and
            // are unnecessary for local media. RFC clients may retry a full
            // response, so serve 200 instead of incorrectly claiming 416.
            byteRange = 0..<fileSize
            statusCode = 200
        } else if let requestedRange {
            guard let parsed = LocalAssetResolver.parseRange(requestedRange, fileSize: fileSize) else {
                return AssetPayload(
                    url: url,
                    statusCode: 416,
                    headers: ["Content-Range": "bytes */\(fileSize)"],
                    data: Data()
                )
            }
            byteRange = parsed
            statusCode = 206
        } else {
            byteRange = 0..<fileSize
            statusCode = 200
        }

        if isCancelled() { throw URLError(.cancelled) }
        let handle = try FileHandle(forReadingFrom: fileURL)
        defer { try? handle.close() }
        try handle.seek(toOffset: UInt64(byteRange.lowerBound))
        var data = Data()
        data.reserveCapacity(byteRange.count)
        var remaining = byteRange.count
        while remaining > 0 {
            if isCancelled() { throw URLError(.cancelled) }
            let chunk = try handle.read(upToCount: min(remaining, 256 * 1024)) ?? Data()
            if chunk.isEmpty { break }
            data.append(chunk)
            remaining -= chunk.count
        }
        if isCancelled() { throw URLError(.cancelled) }
        var headers = [
            "Accept-Ranges": "bytes",
            // App updates can replace both stable public paths and hashed
            // bundles. Never let WebKit carry an old response across installs.
            "Cache-Control": "no-store",
            "Content-Length": String(data.count),
            "Content-Type": LocalAssetResolver.mimeType(for: fileURL),
        ]
        if statusCode == 206 {
            headers["Content-Range"] =
                "bytes \(byteRange.lowerBound)-\(byteRange.upperBound - 1)/\(fileSize)"
        }
        return AssetPayload(url: url, statusCode: statusCode, headers: headers, data: data)
    }
}

private struct AssetPayload: @unchecked Sendable {
    let url: URL
    let statusCode: Int
    let headers: [String: String]
    let data: Data
}

private final class SchemeTaskBox: @unchecked Sendable {
    let task: any WKURLSchemeTask
    let request: URLRequest
    let id: ObjectIdentifier

    init(_ task: any WKURLSchemeTask) {
        self.task = task
        request = task.request
        id = ObjectIdentifier(task as AnyObject)
    }
}

private final class SchemeTaskState: @unchecked Sendable {
    private let lock = NSLock()
    private var active = Set<ObjectIdentifier>()
    private var operations = [ObjectIdentifier: Operation]()

    func register(_ id: ObjectIdentifier) {
        _ = lock.withLock { active.insert(id) }
    }

    func attach(_ operation: Operation, to id: ObjectIdentifier) {
        lock.withLock {
            if active.contains(id) { operations[id] = operation }
            else { operation.cancel() }
        }
    }

    func cancel(_ id: ObjectIdentifier) {
        lock.withLock {
            active.remove(id)
            operations.removeValue(forKey: id)?.cancel()
        }
    }

    func isActive(_ id: ObjectIdentifier) -> Bool {
        lock.withLock { active.contains(id) }
    }

    func finish(_ id: ObjectIdentifier) -> Bool {
        lock.withLock {
            operations.removeValue(forKey: id)
            return active.remove(id) != nil
        }
    }
}
