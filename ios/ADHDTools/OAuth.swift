import AuthenticationServices
import Network
import UIKit

/// Google sign-in on iOS: the web app asks native_oauth_listen for a loopback port, opens the
/// Google page (native_open_url, in an ASWebAuthenticationSession) with redirect_uri
/// http://127.0.0.1:<port>, and native_oauth_wait returns the query string the listener received
/// (or the adhdtools:// callback). Same flow and same Google client as Android and desktop.
final class OAuth: NSObject {
    static let shared = OAuth()

    private var listener: NWListener?
    private var port: UInt16 = 0
    private var session: ASWebAuthenticationSession?
    private var waiter: CheckedContinuation<String?, Never>?

    func listen() async -> Int {
        stopListener()
        guard let listener = try? NWListener(using: .tcp, on: .any) else { return 0 }
        self.listener = listener
        await withCheckedContinuation { cont in
            listener.stateUpdateHandler = { [weak self] state in
                if case .ready = state {
                    self?.port = listener.port?.rawValue ?? 0
                    cont.resume()
                } else if case .failed = state {
                    cont.resume()
                }
            }
            listener.newConnectionHandler = { [weak self] connection in self?.handle(connection) }
            listener.start(queue: .global())
        }
        return Int(port)
    }

    func wait(timeoutSecs: Double) async -> String? {
        await withCheckedContinuation { cont in
            self.waiter = cont
            Task {
                try? await Task.sleep(nanoseconds: UInt64(timeoutSecs * 1_000_000_000))
                self.complete(nil) // timed out or cancelled
            }
        }
    }

    func open(_ urlString: String) {
        guard let url = URL(string: urlString) else { return }
        if waiter != nil {
            // Inside the sign-in flow: keep the user in an in-app browser sheet.
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "adhdtools") { _, _ in }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.session = session
            session.start()
        } else {
            UIApplication.shared.open(url)
        }
    }

    /// adhdtools://open?code=… — fallback when the loopback listener did not catch the redirect.
    func handleCallback(_ url: URL) {
        guard url.scheme == "adhdtools" else { return }
        complete(url.query ?? "")
    }

    private func handle(_ connection: NWConnection) {
        connection.start(queue: .global())
        var buffer = Data()
        func receiveMore() {
            connection.receive(minimumIncompleteLength: 1, maximumLength: 8192) { data, _, done, error in
                if let data { buffer.append(data) }
                if done || error != nil || buffer.range(of: Data("\r\n\r\n".utf8)) != nil {
                    self.finish(connection: connection, buffer: buffer)
                } else {
                    receiveMore()
                }
            }
        }
        receiveMore()
    }

    private func finish(connection: NWConnection, buffer: Data) {
        defer { connection.cancel() }
        guard let text = String(data: buffer, encoding: .utf8),
              let line = text.split(separator: "\r\n").first,
              line.hasPrefix("GET ") else { return }
        let target = line.split(separator: " ").dropFirst().first ?? ""
        let query = target.split(separator: "?", maxSplits: 1).count > 1
            ? String(target.split(separator: "?", maxSplits: 1)[1].split(separator: " ").first ?? "")
            : ""
        let body = Data("<html><body style=\"font-family:sans-serif;text-align:center;padding-top:4em\">"
            + "Sign-in complete — you can close this tab and return to ADHD Tools.</body></html>".utf8)
        let header = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n"
            + "Content-Length: \(body.count)\r\nConnection: close\r\n\r\n"
        let response = Data(header.utf8) + body
        connection.send(content: response, completion: .idempotent)
        if !query.isEmpty { complete(query) }
    }

    private func complete(_ query: String?) {
        session?.cancel()
        session = nil
        if let waiter {
            self.waiter = nil
            waiter.resume(returning: query)
        }
    }

    private func stopListener() {
        listener?.cancel()
        listener = nil
        port = 0
    }
}

extension OAuth: ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = scene.windows.first else {
            return ASPresentationAnchor()
        }
        return window
    }
}
