# ios/ — the iOS app (read [../AGENTS.md](../AGENTS.md) first)

A small native iOS app (Swift, Xcode, no CocoaPods, no third-party SDK) that runs **the same web
files** as GitHub Pages, the desktop app (`src-tauri/`) and the Android app (`android/`), and adds
what a browser tab cannot do: alarms that ring with the screen off, Google sign-in that stays,
offline files, voice input. User guide: [../docs/ios.md](../docs/ios.md). Build: `npm run ios:build`
(`scripts/build-ios.cjs`, needs macOS + Xcode). CI builds the IPA on a `macos-latest` runner.

**No paid Apple Developer account is needed.** The CI-built `dist-ios/ADHD-Tools.ipa` is unsigned on
purpose: the sideload tool on the device (SideStore, AltStore, Sideloadly) signs it there with the
user's own free Apple ID. Free sideloading expires after 7 days and the store app re-signs it
(manually with one tap, or automatically in the background) — see docs/ios.md.

## How it works

- `ADHDTools/WebView.swift` shows one WKWebView that loads `app://localhost/index.html`.
  `WebSchemeHandler` serves the bundled web files (copied from the repo root at build time by
  `scripts/prepare-ios.cjs`, list in `scripts/web-assets.json`, into `ios/web/`, gitignored) at the
  custom `app://` scheme, so ES modules and `localStorage` work like on GitHub Pages.
- Before the page's scripts run, `ADHDTools/bridge.js` (a `WKUserScript` at document start) defines
  `window.__TAURI__.core.invoke` (same API as the desktop app) and `window.__ADHD_IOS__`. Calls go
  to `NativeBridge.swift` through the `adhdBridge` `WKScriptMessageHandler`. **The web code needs no
  iOS branch:** `AttentionService.isNative()` is true and every `invokeNative('native_…')` works.

| File | Role |
| --- | --- |
| `ADHDTools.xcodeproj/project.pbxproj` | Xcode project (hand-generated, deterministic UUIDs; regenerate with care if files are added) |
| `ADHDTools/ADHDToolsApp.swift` | SwiftUI entry, notification delegate, restores scheduled alarms on launch, `adhdtools://` URL handler |
| `ADHDTools/WebView.swift` | WKWebView + `app://` scheme handler serving `web/` from the bundle |
| `ADHDTools/NativeBridge.swift` | One `case "native_…":` per desktop command (`src-tauri/src/lib.rs`), plus `ios_save_file` (share sheet for exports) |
| `ADHDTools/Alarms.swift` | Local notifications (`UNUserNotificationCenter`) for alarms that fire with the screen off/app closed, in-app alarm loop (`AVAudioPlayer`) |
| `ADHDTools/OAuth.swift` | Google sign-in: loopback `NWListener` on 127.0.0.1 + `ASWebAuthenticationSession`, same redirect as Android (`http://127.0.0.1:<port>`) |
| `ADHDTools/SpeechSession.swift` | Voice input with `SFSpeechRecognizer`, same `{status, transcript, error}` answers as Android's `SpeechSession` |
| `ADHDTools/Storage.swift` | `native_save/load_storage` in UserDefaults, `native_save/load_secrets` in the Keychain (never synced to iCloud) |
| `ADHDTools/bridge.js` | The `__TAURI__` shim and blob/data download → `ios_save_file` |
| `ADHDTools/Info.plist` | Permissions (notifications, microphone, speech), `adhdtools://` scheme, background audio, full screen |
| `ADHDTools/Resources/*.aiff` | `alarm.aiff` (intrusive, loops in-app, ≤ 30 s for notifications), `bell.aiff` (standard sound) |
| `ADHDTools/*.lproj/InfoPlist.strings` | Permission texts in en/fr/de/es |
| `web/` | Copied web app (gitignored; `npm run ios:prepare`) |

## Alarms

- The Now view sends the coming alarms with `AttentionService.scheduleAlarms` → `native_schedule_alarms`
  (today's starts/ends from `NowState.alarmPlan`, plus tomorrow's fixed items, max 36 h ahead, max 50).
  iOS keeps pending **local notifications** across app restarts, so they ring even when the app is
  closed or the screen is off; `Alarms.restoreScheduled()` re-registers them on every launch.
- `notificationStyle` picks the sound: `intrusive` → `alarm.aiff` + repeats every 30 s until the app
  is opened, `standard` → one `bell.aiff`, `subtle` → silent. While the app is on screen, scheduled
  notifications are suppressed (`willPresent` returns `[]`) because the web app shows its own alarm
  modal and rings via `native_start_alarm`.
- When the user opens the app (foreground or tapping the notification), `Alarms.stopRinging()` cancels
  the pending repeats; the web app's own alarm (Done / Snooze) takes over.

## Keep the four apps aligned

All apps share the web code, so a fix there reaches all of them. The native layers must follow each other:

- **New native command:** add it to `src-tauri` (`#[tauri::command]` + `generate_handler!`), a case in
  `android/.../NativeBridge.java` **and** a case in `ios/ADHDTools/NativeBridge.swift`.
  `tests/native-alignment.test.js` fails otherwise, and when a command has no caller left.
- **New top-level folder of web files:** add it to `scripts/web-assets.json` (used by all native builds).
- **Version:** change it in `package.json` (`scripts/build-ios.cjs` passes it to xcodebuild as
  `MARKETING_VERSION`; the test checks this).
- **New file in `ios/ADHDTools/`:** add it to `ADHDTools.xcodeproj/project.pbxproj` (Sources or
  Resources phase) — keep the deterministic-UUID style of the file.
- CI builds the IPA (`ios` job) and compile-checks the desktop app (`desktop` job) on every PR.

## Rules

- No third-party SDKs and no new network requests from the app itself (see the privacy rule in
  [../AGENTS.md](../AGENTS.md)). Only Apple system frameworks are linked.
- User-visible native texts (permission dialogs) go in `ADHDTools/*.lproj/InfoPlist.strings` in all
  four languages.
- Never commit a signing certificate or provisioning profile. The distributed IPA stays unsigned;
  signing happens on the user's device with their own Apple ID. Secrets are in the Keychain only.
