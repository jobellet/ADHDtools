# Android app

The Android app is the same app as the website and the desktop app, but it can do things a browser
tab cannot:

- **Alarms ring with the screen off,** and when the app is closed. When a task, routine or event
  starts or ends, your phone rings like an alarm clock, also on the lock screen. Tomorrow's routines
  and events ring too, even if you do not open the app in the morning.
- **The running timer is in the notification shade** (routine step, focus timer, current task).
- **Google stays connected.** You sign in once; the app keeps the connection.
- **Works offline.** The app's files are inside the app.
- **Voice input** with Android's speech recognition.
- **Your data is kept on the phone** (and in your Google Drive if you turn on Drive sync).

It is not in the Play Store. You build it on your computer for free and copy it to your phone.

## Build the app (once, about 10 minutes)

On a Mac with [Node.js](https://nodejs.org) and [Homebrew](https://brew.sh):

```bash
brew install --cask temurin android-commandlinetools
sdkmanager "platforms;android-35" "build-tools;35.0.0" "platform-tools"
```

Then, in the `ADHDtools` folder:

```bash
npm ci
npm run android:build
```

The app is now in `dist-android/ADHD-Tools.apk`.

The first build creates **your signing key** in `~/.config/adhd-tools-android/`. **Back up this
folder.** Android installs an update over the old app (and keeps your data) only if the same key
signed it. Without the key, you must uninstall the app (and lose its data) before you install a new build.

## Put it on your phone

**With a USB cable (simplest for updates):**

1. On the phone: **Settings → About phone →** tap **Build number** 7 times. Then **Settings → System →
   Developer options → USB debugging** on.
2. Connect the phone and allow the computer when the phone asks.
3. Run `npm run android:install`.

**Without a cable:** send `dist-android/ADHD-Tools.apk` to yourself (Google Drive, email, chat).
Open it on the phone. Android asks to allow installs from that app: allow it, then tap **Install**.

On the first start, allow **notifications**. Alarms need them.

## Update

Run `git pull && npm ci && npm run android:build` (or `android:install`), then install the new APK over
the old one. Your tasks, routines and Google connection stay.

## Connect Google (Calendar and Drive sync)

The phone app signs in like the desktop app: it needs a **Desktop app** OAuth client (ID and secret).
*(Important: A "Web application" or "Android" client ID type from Google Cloud Console will not work with loopback redirect and will return "Error 401: invalid_client — The OAuth client was not found".)*

### Option 1 — Transfer from your computer (easiest)
If you already use the app or AI assistant on your computer:
- In the computer app: go to **More → Settings → Calendar Notifications & Google Sync** and click **Copy for Android** (or use **Settings → Export Credentials**).
- Send the copied text or credentials file to your phone (via email, Signal, notes, etc.).
- In the Android app: paste it directly into the **Client ID** box: both the Client ID and Secret are extracted automatically. Tap **Save**.

### Option 2 — Set up manually
1. If you set up the AI assistant ([mcp.md](mcp.md)), you already have credentials in `~/.config/adhd-tools-mcp/credentials.json`. Otherwise create one:
   [Google Auth Platform → Clients](https://console.cloud.google.com/auth/clients) → **+ Create client →
   Desktop app**, in the same project as your Calendar Client ID.
2. In the app: **More → Settings → Calendar Notifications & Google Sync**: paste the **Client ID** and the
   **Client secret**, then **Save**. Tip: copy the whole JSON file Google gives you and paste it into the
   **Client ID** box: both fields fill in automatically.
3. Tap **Connect & Sync**. Chrome opens Google's page. After you allow access, tap **Back to ADHD Tools**.

### Troubleshooting Google Sign-In
- **"Error 401: invalid_client — The OAuth client was not found":** This happens if the Client ID has a typo, missing characters, or was created as a "Web application" instead of "Desktop app". Make sure your Client ID ends with `.apps.googleusercontent.com` and was created with type **Desktop app**.
- **"Client Secret missing":** Unlike the web browser, native apps (Android and Desktop) require the Client Secret (starting with `GOCSPX-`) to exchange the auth code offline. Make sure it is saved.

You do this once. The app keeps the connection after restarts and updates.

## Alarms: if one does not ring

- **Settings → Apps → ADHD Tools → Notifications:** on, and the **Alarms** category allowed.
- **Settings → Apps → ADHD Tools → Battery:** **Unrestricted** helps on some phones (Samsung, Xiaomi,
  Huawei stop apps in the background).
- The alarm style follows **More → Settings → General → Alarm & notification style**: *intrusive* rings like an
  alarm clock, *standard* plays one sound, *subtle* is silent.
- An alarm turns the screen on and opens the app over the lock screen. It rings until you touch the screen
  or tap **Stop**. When the app is already open, it shows its own alarm (with **Done** and **Snooze**) instead.

## Good to know

- The phone keeps its own copy of your data. Use **Google Drive sync** ([sync-across-devices.md](sync-across-devices.md))
  to have the same tasks on the phone and the computer.
- **Back** puts the app in the background; it does not close it.
- The mini-player button opens Android's picture-in-picture window.
- Export buttons open Android's **Save as** screen.
