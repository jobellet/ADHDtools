import SwiftUI
import UIKit
import WebKit

/// The whole app: one WKWebView running the same web files as GitHub Pages, the desktop app
/// and the Android app (copied into ios/web/ by scripts/prepare-ios.cjs, served at app://localhost).
struct WebView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(WebSchemeHandler(), forURLScheme: WebSchemeHandler.scheme)
        config.mediaTypesRequiringUserActionForPlayback = []
        if let bridgePath = Bundle.main.path(forResource: "bridge", ofType: "js"),
           let source = try? String(contentsOfFile: bridgePath, encoding: .utf8) {
            config.userContentController.addUserScript(
                WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        let bridge = NativeBridge()
        config.userContentController.add(bridge, name: "adhdBridge")
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isInspectable = true
        if let url = URL(string: "\(WebSchemeHandler.scheme)://localhost/index.html") {
            webView.load(URLRequest(url: url))
        }
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

/// Serves the bundled web app from the app bundle at app://localhost/ (like Capacitor does),
/// so ES modules and localStorage work exactly as on GitHub Pages.
final class WebSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "app"

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(NSError(domain: WebSchemeHandler.scheme, code: 400))
            return
        }
        var path = url.path
        if path.isEmpty || path == "/" { path = "/index.html" }
        let base = ((Bundle.main.resourcePath ?? "") as NSString).standardizingPath + "/web"
        var filePath = (base as NSString).appendingPathComponent(path.hasPrefix("/") ? String(path.dropFirst()) : path)
        filePath = (filePath as NSString).standardizingPath
        var isDir: ObjCBool = false
        if FileManager.default.fileExists(atPath: filePath, isDirectory: &isDir), isDir.boolValue {
            filePath = (filePath as NSString).appendingPathComponent("index.html")
        }
        guard filePath.hasPrefix(base), let data = FileManager.default.contents(atPath: filePath) else {
            urlSchemeTask.didFailWithError(NSError(domain: WebSchemeHandler.scheme, code: 404))
            return
        }
        let response = URLResponse(url: url, mimeType: Self.mime(for: filePath),
                                   expectedContentLength: data.count, textEncodingName: "utf-8")
        urlSchemeTask.didReceive(response)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    private static func mime(for path: String) -> String {
        switch (path as NSString).pathExtension.lowercased() {
        case "html": return "text/html"
        case "js", "mjs": return "text/javascript"
        case "css": return "text/css"
        case "json", "map": return "application/json"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "gif": return "image/gif"
        case "ico": return "image/x-icon"
        case "mp3": return "audio/mpeg"
        case "wav": return "audio/wav"
        case "aiff": return "audio/aiff"
        case "woff", "woff2": return "font/woff2"
        case "md": return "text/markdown"
        default: return "application/octet-stream"
        }
    }
}
