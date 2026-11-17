# iPhone / iPad app

The iOS app is the same app as the website, the desktop app and the Android app, but it can do
things a browser tab cannot:

- **Alarms ring with the screen off,** and when the app is closed. When a task, routine step or
  event starts or ends, your iPhone/iPad rings like an alarm clock, also on the lock screen.
  Tomorrow's routines and events ring too, even if you do not open the app in the morning.
- **Google stays connected.** You sign in once; the app keeps the connection.
- **Works offline.** The app's files are inside the app.
- **Voice input** with iOS speech recognition.
- **Your data stays on your device** (and in your Google Drive if you turn on Drive sync).

It is **not in the App Store, and it costs nothing** — no 99 $/year Apple Developer account. You
download an `.ipa` file and install it with a free Apple ID (sideloading). The trade-off: Apple
makes sideloaded apps expire after **7 days**, and a small sideload app on your device re-signs
them for you — usually automatically, at worst with **one tap** (see below).

## Download and install (simplest)

1. On your iPhone/iPad, open
   [ADHD-Tools.ipa](https://github.com/jobellet/ADHDtools/releases/latest/download/ADHD-Tools.ipa)
   (or the `ADHD-Tools-iOS-IPA` artifact of the latest run in
   [GitHub Actions](https://github.com/jobellet/ADHDtools/actions)) and download it.
2. Install a sideload tool **once** with your free Apple ID (use an *app-specific password* from
   appleid.apple.com — never your main password, and only inside the app on your own device,
   never on a website):
   - **SideStore** (recommended): after the first install it **re-signs all your apps by itself,
     in the background, without any computer**. When an app expires, just open SideStore and tap
     **Refresh All** — one tap, done.
   - **AltStore**: also re-signs automatically, but it needs AltServer running on a Mac/PC on the
     same Wi-Fi network.
   - **Sideloadly** (from a Mac/PC, USB cable) or **Xcode** (Mac, USB cable): sign and install
     manually each time.
3. In the sideload tool, add `ADHD-Tools.ipa` and install it. Grant the notifications permission
   when asked — that is what makes the alarms ring.

Limits of a free Apple ID: the app expires every 7 days (re-signed as above) and you can sideload
at most 3 apps per Apple ID.

## Build the app yourself (optional)

On a Mac with Xcode (free from the Mac App Store) and Node.js:

```bash
npm ci
npm run ios:build
```

The app is then in `dist-ios/ADHD-Tools.ipa` (unsigned — install it with SideStore/AltStore/Sideloadly
as above, which signs it with your Apple ID). CI builds the same IPA on every push to `main`.

## Privacy

The app makes no requests to any server of its own. Signing happens **on your device** with your
own Apple ID; the IPA from GitHub Releases is not signed by us and we never see your credentials.
Your data stays in the app's storage on the device (secrets in the Keychain, never in iCloud
backup) unless you turn on Google Drive / Calendar sync yourself.
