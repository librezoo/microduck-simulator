import Foundation
import UniformTypeIdentifiers
import WebKit

enum LocalAssetResolver {
    enum RangeSelection: Equatable {
        case fullResponse
        case partial(Range<Int>)
        case unsatisfiable
    }

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
        let header = header.trimmingCharacters(in: .whitespacesAndNewlines)
        guard fileSize > 0, header.lowercased().hasPrefix("bytes=") else { return nil }
        let value = header.dropFirst(6).trimmingCharacters(in: .whitespaces)
        guard !value.contains(","), let dash = value.firstIndex(of: "-") else { return nil }
        let lowerText = value[..<dash].trimmingCharacters(in: .whitespaces)
        let upperText = value[value.index(after: dash)...].trimmingCharacters(in: .whitespaces)

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

    static func selectRange(_ header: String?, fileSize: Int) -> RangeSelection {
        guard let header else { return .fullResponse }
        let normalizedHeader = header.trimmingCharacters(in: .whitespacesAndNewlines)
        guard normalizedHeader.lowercased().hasPrefix("bytes=") else { return .unsatisfiable }

        let value = normalizedHeader.dropFirst(6)
        let specifications = value.split(separator: ",", omittingEmptySubsequences: false)
        if specifications.count > 1 {
            // WKURLSchemeHandler cannot produce a multipart/byteranges body.
            // RFC 9110 permits a server to ignore Range, but only do that for
            // a syntactically valid multi-range request; malformed requests
            // must not be mistaken for an ordinary full-file request.
            return specifications.allSatisfy(isValidRangeSpecification)
                ? .fullResponse
                : .unsatisfiable
        }

        guard let range = parseRange(normalizedHeader, fileSize: fileSize) else {
            return .unsatisfiable
        }
        return .partial(range)
    }

    private static func isValidRangeSpecification(_ rawValue: Substring) -> Bool {
        let value = rawValue.trimmingCharacters(in: .whitespaces)
        guard
            !value.isEmpty,
            let dash = value.firstIndex(of: "-"),
            value[value.index(after: dash)...].firstIndex(of: "-") == nil
        else { return false }

        let lowerText = value[..<dash].trimmingCharacters(in: .whitespaces)
        let upperText = value[value.index(after: dash)...].trimmingCharacters(in: .whitespaces)
        if lowerText.isEmpty {
            return Int(upperText).map { $0 > 0 } ?? false
        }
        guard let lower = Int(lowerText), lower >= 0 else { return false }
        guard !upperText.isEmpty else { return true }
        return Int(upperText).map { $0 >= lower } ?? false
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

    deinit {
        taskState.cancelAll()
        loadingQueue.cancelAllOperations()
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: any WKURLSchemeTask) {
        let box = SchemeTaskBox(urlSchemeTask)
        taskState.register(box.id)
        let root = root
        let state = taskState
        let operation = BlockOperation {
            guard state.shouldContinue(box.id) else { return }
            let result = Result {
                try Self.load(box.request, root: root) {
                    !state.shouldContinue(box.id)
                }
            }
            guard state.shouldContinue(box.id) else { return }
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

    nonisolated static func load(
        _ request: URLRequest,
        root: URL,
        isCancelled: @Sendable () -> Bool
    ) throws -> AssetPayload {
        if isCancelled() { throw URLError(.cancelled) }
        guard
            let url = request.url,
            let fileURL = LocalAssetResolver.resolve(url, below: root),
            FileManager.default.fileExists(atPath: fileURL.path),
            let attributes = try? FileManager.default.attributesOfItem(atPath: fileURL.path),
            let sizeNumber = attributes[.size] as? NSNumber
        else {
            throw URLError(.fileDoesNotExist)
        }
        if isCancelled() { throw URLError(.cancelled) }

        let fileSize = sizeNumber.intValue
        let byteRange: Range<Int>
        let statusCode: Int
        switch LocalAssetResolver.selectRange(
            request.value(forHTTPHeaderField: "Range"),
            fileSize: fileSize
        ) {
        case .fullResponse:
            byteRange = 0..<fileSize
            statusCode = 200
        case .partial(let range):
            byteRange = range
            statusCode = 206
        case .unsatisfiable:
            if isCancelled() { throw URLError(.cancelled) }
            return AssetPayload(
                url: url,
                statusCode: 416,
                headers: ["Content-Range": "bytes */\(fileSize)"],
                data: Data()
            )
        }

        if isCancelled() { throw URLError(.cancelled) }
        let handle = try FileHandle(forReadingFrom: fileURL)
        defer { try? handle.close() }
        if isCancelled() { throw URLError(.cancelled) }
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

struct AssetPayload: @unchecked Sendable {
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

final class SchemeTaskState: @unchecked Sendable {
    private let lock = NSLock()
    private var active = Set<ObjectIdentifier>()
    private var operations = [ObjectIdentifier: Operation]()

    func register(_ id: ObjectIdentifier) {
        _ = lock.withLock { active.insert(id) }
    }

    func attach(_ operation: Operation, to id: ObjectIdentifier) {
        let shouldCancel = lock.withLock {
            guard active.contains(id) else { return true }
            operations[id] = operation
            return false
        }
        if shouldCancel { operation.cancel() }
    }

    func cancel(_ id: ObjectIdentifier) {
        let operation = lock.withLock {
            active.remove(id)
            return operations.removeValue(forKey: id)
        }
        operation?.cancel()
    }

    func shouldContinue(_ id: ObjectIdentifier) -> Bool {
        lock.withLock {
            active.contains(id) && operations[id]?.isCancelled == false
        }
    }

    func finish(_ id: ObjectIdentifier) -> Bool {
        lock.withLock {
            operations.removeValue(forKey: id)
            return active.remove(id) != nil
        }
    }

    func cancelAll() {
        let pendingOperations = lock.withLock {
            active.removeAll()
            defer { operations.removeAll() }
            return Array(operations.values)
        }
        pendingOperations.forEach { $0.cancel() }
    }
}
