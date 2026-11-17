import UIKit
import WebKit

/// The iOS side of window.__TAURI__.core.invoke (see bridge.js). Every "native_…" command the web
/// app calls must have a case here AND in src-tauri AND in android/…/NativeBridge.java
/// (tests/native-alignment.test.js checks this), so all apps stay in step.
final class NativeBridge: NSObject, WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? String,
              let data = body.data(using: .utf8),
              let request = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let id = request["id"] as? Int,
              let cmd = request["cmd"] as? String,
              let webView = message.webView else { return }
        let args = request["args"] as? [String: Any] ?? [:]
        Task {
            let (ok, value, error) = await NativeBridge.dispatch(cmd: cmd, args: args)
            var reply: [String: Any] = ["id": id, "ok": ok]
            if ok {
                reply["value"] = value ?? NSNull()
            } else {
                reply["error"] = error ?? "failed"
            }
            guard let json = try? JSONSerialization.data(withJSONObject: reply),
                  var script = String(data: json, encoding: .utf8) else { return }
            script = script
                .replacingOccurrences(of: "\u{2028}", with: "\\u2028")
                .replacingOccurrences(of: "\u{2029}", with: "\\u2029")
            _ = try? await webView.evaluateJavaScript("window.__ADHD_IOS_BRIDGE_CALLBACK__(\(script));")
        }
    }

    private static func dispatch(cmd: String, args: [String: Any]) async -> (ok: Bool, value: Any?, error: String?) {
        do {
            let value = try await handle(cmd: cmd, args: args)
            return (true, value, nil)
        } catch {
            return (false, nil, String(describing: error))
        }
    }

    private static func handle(cmd: String, args: [String: Any]) async throws -> Any? {
        // native_oauth_listen / native_oauth_wait wait on the loopback listener, so they are async.
        switch cmd {
        case "native_oauth_listen":
            return await OAuth.shared.listen()
        case "native_oauth_wait":
            return await OAuth.shared.wait(timeoutSecs: args["timeoutSecs"] as? Double ?? 300)
        default:
            break
        }
        return try await MainActor.run {
            switch cmd {
            case "native_notify":
                Alarms.notifyNow(title: args["title"] as? String ?? "",
                                 body: args["body"] as? String ?? "",
                                 sound: args["sound"] as? String ?? "bell")
                return nil
            case "native_bring_to_front":
                return nil // iOS does not let an app jump in front of another one.
            case "native_set_keep_awake":
                UIApplication.shared.isIdleTimerDisabled = (args["active"] as? Bool) ?? false
                return nil
            case "native_start_alarm":
                Alarms.startRinging()
                return nil
            case "native_stop_alarm":
                Alarms.stopRinging() // the user dismissed the web app's alarm
                return nil
            case "native_play_sound":
                Alarms.playOnce(sound: args["sound"] as? String ?? "bell")
                return nil
            case "native_update_tray":
                return nil // iOS has no tray; the page already updates the document title.
            case "native_schedule_alarms":
                Alarms.schedule(alarms: args["alarms"], style: args["style"] as? String ?? "intrusive")
                return nil
            case "native_toggle_mini_player":
                return nil // no floating mini player on iOS
            case "native_save_storage":
                Storage.saveStore(args["data"] as? String ?? "")
                return nil
            case "native_load_storage":
                return Storage.loadStore()
            case "native_save_secrets":
                Storage.saveSecrets(args["data"] as? String ?? "")
                return nil
            case "native_load_secrets":
                return Storage.loadSecrets()
            case "native_open_url":
                guard let url = args["url"] as? String, url.hasPrefix("https://") else {
                    throw NSError(domain: "adhd", code: 1, userInfo: [NSLocalizedDescriptionKey: "Only https URLs can be opened"])
                }
                OAuth.shared.open(url)
                return nil
            case "native_read_mcp_client":
                return nil // The AI assistant's Google client lives on the computer, not on the phone.
            case "native_start_speech":
                SpeechSession.shared.start(args["lang"] as? String ?? "en-US")
                return nil
            case "native_poll_speech":
                return SpeechSession.shared.snapshot()
            case "native_stop_speech":
                return SpeechSession.shared.stop()
            case "native_local_ai_status":
                return ["available": false, "running": false, "port": 11434]
            case "native_local_ai_start":
                return ["available": false, "running": false] // no local LLM on iOS
            case "native_local_ai_stop":
                return ["available": false, "running": false]
            case "ios_save_file":
                try saveFile(name: args["name"] as? String ?? "download",
                             mime: args["mime"] as? String ?? "application/octet-stream",
                             base64: args["base64"] as? String ?? "")
                return nil
            default:
                throw NSError(domain: "adhd", code: 2, userInfo: [NSLocalizedDescriptionKey: "Unknown command \(cmd)"])
            }
        }
    }

    private static func saveFile(name: String, mime: String, base64: String) throws {
        guard let data = Data(base64Encoded: base64) else {
            throw NSError(domain: "adhd", code: 3, userInfo: [NSLocalizedDescriptionKey: "Bad file data"])
        }
        let url = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent(name)
        try data.write(to: url)
        let activity = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let root = scene.windows.first?.rootViewController else { return }
        root.present(activity, animated: true)
    }
}
