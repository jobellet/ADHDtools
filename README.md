<p align="center">
  <a href="README.md"><img src="docs/flags/gb.svg" height="20" alt="English"> English</a> ·
  <a href="README.de.md"><img src="docs/flags/de.svg" height="20" alt="Deutsch"> Deutsch</a> ·
  <a href="README.fr.md"><img src="docs/flags/fr.svg" height="20" alt="Français"> Français</a> ·
  <a href="README.es.md"><img src="docs/flags/es.svg" height="20" alt="Español"> Español</a>
</p>

# ADHD Tools Hub

A day planner for people with ADHD that shows **one thing at a time**. It runs in your browser or as a native app: your data stays on your device unless *you* turn on a sync option. Offline-first, no account required.

### 🚀 Get Started (Choose your platform)

| 🌐 Web App (Instant) | 🪟 Windows Desktop | 🍎 macOS Desktop | 📱 Android Phone |
| :---: | :---: | :---: | :---: |
| [**▶ Open Live App**](https://jobellet.github.io/ADHDtools/) | [**⬇ Download (.exe)**](https://github.com/jobellet/ADHDtools/releases/latest/download/ADHD-Tools-Setup.exe) | [**⬇ Download (.dmg)**](https://github.com/jobellet/ADHDtools/releases/latest/download/ADHD-Tools.dmg) | [**⬇ Download (.apk)**](https://github.com/jobellet/ADHDtools/releases/latest/download/ADHD-Tools.apk) |
| *No install required* | *System tray & notifications* | *Menu bar & native alarms* | *Alarms with screen off* |
| Click and plan | Run installer setup | Drag to Applications | Tap and install |

> **All versions are 100% free and open-source.** Your data stays completely offline on your device, with optional private Google Drive / Calendar sync across devices.

## The idea: as little to think about as possible

At any moment you only do one of three things:

1. **Do** the task on the screen. The app opens on the **Now** view: the current task, routine step or event, with a big countdown and 2–3 buttons (*Done*, *Focus*, *Not now*).
2. **Rest** and see what comes next. In a short gap, the Now view shows a countdown to the next item.
3. **Plan** ahead. When nothing is planned, the app opens the **Day Planner**. There you place tasks and split big tasks with deadlines into small steps.

Routines (morning, evening, anything you create) **book their time** in your day, with a buffer (+10 % by default). Nothing else can be scheduled at the same time: a task added at a busy time moves to the next free slot, and the app tells you why.

➡️ **New here? Read the [user guide](docs/using-the-app.md).**

## Quick demo

Adding a task works offline, without any AI:

```text
Input:  Call mom tomorrow at 5pm for 20 min !7
Result: Call mom — tomorrow at 17:00 · 20 min · importance 7 · fixed time
```

If 17:00 is already taken (for example by your evening routine), the task moves to the next free slot.

## 🧰 Features

**Core**

*   **Now view (default):** the current task, routine step or event with a countdown, and what comes next.
*   **Day Planner:** the whole day on a timeline: routines, fixed tasks, tasks placed by the app, calendar events. A *Plan ahead* panel lists deadlines and big tasks to split, and deletes overdue tasks one by one or all at once (with Undo).
*   **Routines:** timed steps played one at a time. Each routine books its time (steps + buffer); overlapping routines can't be saved.
*   **Quick capture (Add):** type or speak a task in plain words. Works offline; better with [AI](docs/ai-providers.md) if you set it up.
*   **Unified scheduler:** one plan across tasks, routines and calendar events, ordered by importance × urgency, with no double booking.

**More tools**

*   **Task Breakdown:** split a big task into small steps (manually or with AI).
*   **Focus Mode** and **Pomodoro Timer:** full-screen timers for deep work.
*   **Calendar:** private [Google Calendar](docs/google-calendar-sync.md) sync, or `.ics` file / link import.
*   **Habit Tracker** and **Rewards:** streaks, points for finished tasks, rewards you choose.
*   **Several users** on one device, and **4 languages** (English, Deutsch, Français, Español).

**Adapts to your setup**

The app only shows the options you use. For example, `.ics` import is hidden once Google Calendar is connected, and AI buttons are hidden without an AI provider. *Settings → General → Show all options* shows everything again.

## 🖥️ Desktop app (optional)

A native app adds system notifications when a timer ends, a menu-bar/tray timer, a screen that stays awake during Focus/Routine, a floating mini-player, and a disk copy of your data. Everything else works the same as in the browser.

### Option A — Pre-built Installers (Fastest)

*   **🪟 Windows:** Download [**ADHD-Tools-Setup.exe**](https://github.com/jobellet/ADHDtools/releases/latest/download/ADHD-Tools-Setup.exe), run the installer, and open ADHD Tools from your Start Menu.
*   **🍎 macOS:** Download [**ADHD-Tools.dmg**](https://github.com/jobellet/ADHDtools/releases/latest/download/ADHD-Tools.dmg), drag **ADHD Tools** to your *Applications* folder, and open it.
*   **📱 Android:** Download [**ADHD-Tools.apk**](https://github.com/jobellet/ADHDtools/releases/latest/download/ADHD-Tools.apk) on your phone and tap Install.

### Option B — Build on your machine (Developers)

**macOS:**
```bash
git clone https://github.com/jobellet/ADHDtools.git
cd ADHDtools && npm ci
npm run desktop:install
```
*ADHD Tools is installed into `/Applications` and launches automatically.*

**Windows:**
```powershell
git clone https://github.com/jobellet/ADHDtools.git
cd ADHDtools; npm ci
npm run desktop:install
```
*Builds the Windows app, adds an ADHD Tools shortcut to your Start Menu, and launches it.*

**Voice input (microphone) on macOS:** the first time you click the microphone button, macOS asks for permission to use the **Microphone** and **Speech Recognition**. Make sure ADHD Tools is enabled under **System Settings → Privacy & Security → Microphone & Speech Recognition**.

**Updating:** Just run `git pull && npm ci && npm run desktop:install`. Your local data and keys are kept on disk.

**Try it without installing:** `npm run desktop` opens the app in a dev window.

## 📱 Android app (optional, free, no Play Store)

The Android app rings like an alarm clock when a task, routine or event starts or ends, **even with the screen off or the app closed**. It shows the running timer in the notification shade and keeps you signed in to Google.

*   **Download:** Get [**ADHD-Tools.apk**](https://github.com/jobellet/ADHDtools/releases/latest/download/ADHD-Tools.apk) from the latest release and tap to install.
*   **Build yourself:** Run `npm ci && npm run android:build` (creates `dist-android/ADHD-Tools.apk`). See the [Android guide](docs/android.md) for full details.

## 🤖 Talk to your planner with your AI assistant (MCP)

Ask your AI assistant (Mistral, Claude, or any app that supports MCP) to *"split my tax report into small steps"* or *"find an hour for sport tomorrow"*. The changes show up in the app. Your own Google Drive is the storage: no server of ours, no ngrok, no Tailscale.

**Setup (about 10 minutes):**

1. In the app, connect Google and tap **More → About → Sync Across Devices → Back up now**. Keep *Automatic sync* on.
2. In [Google Auth Platform → Clients](https://console.cloud.google.com/auth/clients), in the **same project** as the app's Client ID: **+ Create client → Desktop app**. Copy the ID and the secret. In **Audience → Test users**, check that your email is there. (Publishing the app is optional: see the guide.)
3. On your computer (Node 18+): `git clone https://github.com/jobellet/ADHDtools.git`, then in that folder:
   `npm run mcp:auth -- --client-id "DESKTOP_CLIENT_ID" --client-secret "CLIENT_SECRET"`
4. Add the server to your AI app's MCP settings: command `node`, argument `/full/path/to/ADHDtools/mcp/server.js`.
   For Le Chat on the web, run `node mcp/server.js http` on a small host (see the guide).
   Then run `git pull` and `npm run mcp:check`: it tests everything and gives the fix for each problem.
5. Ask: *"Give me an overview of my day."* Keep the app open: it applies the changes within about 2 minutes.

**Stuck at any step?** Each step of the guide links to the fix for the message you see: [**Fixing problems**](docs/mcp-troubleshooting.md) (for example ["Publish app" is greyed out](docs/mcp-troubleshooting.md#publish-greyed-out)).

Full guide, Mistral Vibe and Le Chat setup, and troubleshooting: [**docs/mcp.md**](docs/mcp.md).

## 📚 Guides & Tutorials

| Guide | What you'll learn |
| --- | --- |
| [**User guide**](docs/using-the-app.md) | The Now view, Plan, Add, routines, settings. Start here. |
| [**Google Calendar sync**](docs/google-calendar-sync.md) | Private OAuth sync (recommended, no public link), `.ics` file import, or a public ICS link. Full Google Cloud setup tutorial. |
| [**Sync your data across devices**](docs/sync-across-devices.md) | Google Drive backup/restore, file export/import, email, with conflict-safe merging. |
| [**Optional AI assistance**](docs/ai-providers.md) | Use your own provider: OpenAI, Gemini, Claude, Mistral, Groq, OpenRouter, or a local model. Everything also works without AI. |
| [**AI assistant via MCP**](docs/mcp.md) | Let Mistral, Claude or another MCP app read your day, add tasks and split them, through your Google Drive. |
| [**Data model & scheduler**](docs/task-model.md) | The Task object, TaskStore, routine booking and how the scheduler builds your day. |
| [**Vision, roadmap & status**](docs/vision-roadmap.md) | Where the project is going and what already works. |
| [**Manual test cases**](docs/testing.md) | Scenarios to check the app after changes. |
| [**Contributing**](docs/contributing.md) · [**AGENTS.md**](AGENTS.md) | Run the app locally, run the tests, send changes. `AGENTS.md` is the guide for AI coding agents (and humans): code map, shared vocabulary, rules. |

The guides are in English.

## 🔒 Privacy

All data is stored in your browser. Nothing is sent to any server unless you turn on an integration: Google sync goes directly from your browser to Google, and AI requests go directly to the provider you chose. There is no middleman server.

## 💬 Feedback

Suggestions and bug reports are welcome: please open an issue.

## License

MIT License. See the [LICENSE](LICENSE) file.
