# Privacy policy — ADHD Tools Hub

*Last updated: 26 September 2026*

ADHD Tools Hub (https://jobellet.github.io/ADHDtools/) is a free, open-source day planner. This page explains what happens to your data.

## What is stored, and where

- **In your browser:** your tasks, routines, calendar events, habits, rewards and settings are stored in your browser (`localStorage`) on your device. The authors of the app never receive them. There is no account with us, no server of ours, no analytics and no advertising.
- **In your own Google Drive (only if you turn it on):** the backup is a file in a hidden, private *app folder* of your Google Drive. Only this app can see it, not other apps and not us.
- **The AI assistant (MCP server, optional):** it runs on your computer (or on a host you choose). It reads that backup and writes a second file with the changes you asked for, in the same private app folder.

## Google data

When you connect Google, the app asks only for what it needs:

| Access | Why |
| --- | --- |
| Google Calendar (`calendar.events`, `calendar.calendarlist.readonly`) | Show your events in the planner; add an event when you tap *Export* |
| Google Drive app folder (`drive.appdata`) | Back up your data and sync your devices; lets your AI assistant read and plan your day |

The app talks to Google directly from your browser (or from your own computer, for the assistant). Your Google data is not sent to anyone else, not sold, and not used for advertising.
The use of Google data follows the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

Access tokens are kept in your browser session and removed when you close the browser. The assistant keeps its sign-in key in a file only you can read, on the computer where it runs.

## AI providers (only if you turn them on)

If you add an AI provider in the settings, the text you send (for example a task to split) goes directly from your browser to that provider, under its own privacy policy. Your API key stays in your browser and is never in a backup or export.

## Deleting your data

- On your device: clear this site's data in your browser settings.
- In Google Drive: open [Drive → Settings → Manage apps](https://drive.google.com/drive/settings), find the app → **Options** → **Delete hidden app data**.
- Stop all access: remove the app at [myaccount.google.com/connections](https://myaccount.google.com/connections).

## Contact

Questions: [open an issue](https://github.com/jobellet/ADHDtools/issues).
