# android/ — the Android app (read [../AGENTS.md](../AGENTS.md) first)

A small native Android app (Java, Gradle, no Play Store) that runs **the same web files** as GitHub Pages
and the desktop app (`src-tauri/`), and adds what a browser tab cannot do: alarms that ring with the
screen off, a timer in the notification shade, a Google sign-in that stays, offline files.
User guide: [../docs/android.md](../docs/android.md). Build: `npm run android:build` (`scripts/build-android.cjs`).

## How it works

- `MainActivity` shows a WebView. The web files are copied from the repo root at build time
  (Gradle task `copyWebAssets`, list in `scripts/web-assets.json`) and served from
  `https://appassets.androidplatform.net/app/` (`WebViewAssetLoader`), so ES modules and `localStorage` work.
- Before the page's scripts run, `res/raw/android_bridge.js` defines `window.__TAURI__.core.invoke`
  (same API as the desktop app) and `window.__ADHD_ANDROID__`. Calls go to `NativeBridge` through a
  web message listener that only the app's own origin can use. **The web code needs no Android branch:**
  `AttentionService.isNative()` is true and every `invokeNative('native_…')` works.

| File | Role |
| --- | --- |
| `app/build.gradle` | Copies the web files, reads the version from `package.json`, signs with the key from `~/.config/adhd-tools-android/signing.properties` (else the debug key) |
| `app/src/main/AndroidManifest.xml` | Permissions (notifications, exact alarms, full-screen alarm, microphone, boot), the `adhdtools://open` link used after Google sign-in |
| `MainActivity.java` | WebView, system bar insets, file picker, "Save as" for exports, Back = background, picture-in-picture, keep screen on |
| `NativeBridge.java` | One `case "native_…":` per desktop command (`src-tauri/src/lib.rs`), plus `android_save_file` |
| `Alarms.java` | Notification channels, AlarmManager alarms (kept in SharedPreferences), ringing alarm, countdown notification |
| `AlarmReceiver.java` | Rings an alarm when it is due, unless the app is on screen (the web app rings then) |
| `BootReceiver.java` | Sets the saved alarms again after a restart or an app update |
| `SpeechSession.java` | Voice input with Android's recognizer, same answers as the desktop's macOS speech |
| `res/raw/android_bridge.js` | The `__TAURI__` shim and blob/data download → `android_save_file` |
| `res/values*/strings.xml` | Android-side texts in en/fr/de/es (channel names, Stop, sign-in page) |

## Alarms

- The Now view sends the coming alarms with `AttentionService.scheduleAlarms` → `native_schedule_alarms`
  (today's starts/ends from `NowState.alarmPlan`, plus tomorrow's fixed items). Countdowns (routine step,
  focus timer, current task) arrive through `native_update_tray`: a chronometer notification + one end alarm.
- `notificationStyle` picks the channel: `intrusive` → **Alarms** (alarm sound repeats until opened or
  stopped, full screen on the lock screen), `standard` → **Reminders** (one sound), `subtle` → **Quiet reminders**.
- An alarm that opens the app (full screen, over the lock screen) keeps ringing until the user touches the
  screen, taps **Stop**, or dismisses the web app's alarm (`native_stop_alarm`). When the user opens the app
  any other way, ringing alarms stop and the web app shows its own alarm (Done / Snooze).

## Keep the three apps aligned

All apps share the web code, so a fix there reaches all three. The native layers must follow each other:

- **New native command:** add it to `src-tauri` (`#[tauri::command]` + `generate_handler!`) **and** a case in
  `NativeBridge.java`. `tests/native-alignment.test.js` fails otherwise, and when a command has no caller left.
- **New top-level folder of web files:** add it to `scripts/web-assets.json` (used by both native builds).
- **Version:** change it in `package.json` and `src-tauri/Cargo.toml` (the test checks they match).
- CI builds the APK (`android` job) and compile-checks the desktop app (`desktop` job) on every PR.

## Rules

- No new third-party requests (see the privacy rule in [../AGENTS.md](../AGENTS.md)). The only Java
  dependency is `androidx.webkit`.
- User-visible Android texts go in `res/values*/strings.xml` in all four languages.
- Never commit a signing key (`*.jks` is ignored). Keys and Google tokens are in `adhd-secrets.json`
  in the app's private folder; `allowBackup` is off so they never go to Android cloud backup.
