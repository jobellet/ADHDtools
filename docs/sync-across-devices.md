# Sync Your Data Across Devices

All app data lives in your browser's local storage — private by design, but it means your phone and your laptop each start with their own copy. Here are the ways to move or sync data between devices, from easiest to most manual.

> **What gets synced?** Everything the app stores: tasks, routines, habits, rewards, settings — *including any API keys you saved*. Treat backup files accordingly.

---

## Option 1 — Google Drive backup & restore (recommended)

The app can save a snapshot into a **private Google Drive app folder** (hidden from your normal Drive files, readable only by this app) and restore it on any other device.

### One-time setup

You need a Google OAuth Client ID — the **same one used for Google Calendar sync**. Follow [Step A of the Google Calendar tutorial](google-calendar-sync.md#step-a--create-a-free-google-cloud-oauth-client-id), and make sure you also enable the **Google Drive API** in your Google Cloud project (APIs & Services → Library → Google Drive API → Enable).

Then on **each device**: open **More → Settings → Calendar Notifications & Google Sync** and save the same Client ID in the **Google Calendar API** box.

### Back up (on the device that has your data)

1. Open **More → About** and find **Sync Across Devices (Google Drive)**.
2. Click **Back up now** and complete the Google popup if asked.
3. The status line shows the time of your last backup.

### Restore (on the new device)

1. Same place: **More → About → Sync Across Devices (Google Drive)**.
2. Click **Restore from Drive** and sign in with the **same Google account**.
3. If some items exist on both devices, a conflict dialog lets you choose per item: keep existing, overwrite, or keep both. The app then reloads with the merged data.

Repeat backup/restore whenever you want to push fresh data around.

### Automatic sync (optional)

Leave **“Automatic sync”** checked (**More → About**, under the Drive buttons) and the app handles the round-trips for you:

- **On startup:** if another device pushed a newer backup to Drive, it is pulled and merged automatically — new items appear, and for items changed on both sides the most recent version wins. Only a *true* conflict (the same item edited differently on two devices with no way to tell which is newer) opens the manual conflict dialog.
- **Daily:** after 24h without a backup, your local snapshot is pushed to Drive (also when you hide the tab).
- **Never opens a Google popup on its own** — automatic sync only runs when you have already granted Drive access in this browser. Uncheck it anytime to go fully manual.

---

## Option 2 — Export / import a file

No Google account needed.

1. On the source device: **More → About → Data Management → Export Data** downloads a JSON file.
2. Move the file to the other device any way you like — **any cloud folder (iCloud Drive, Google Drive, Dropbox, Syncthing…), USB stick, AirDrop**.
3. On the target device: **More → About → Data Management → Import Data** and select the file. The same conflict dialog as above handles overlaps.

💡 Tip: exporting into a folder that your devices already sync (e.g. iCloud or Dropbox) makes this a two-click routine.

---

## Option 3 — Email it to yourself

**More → About → Data Management → Email Data** exports the file and opens a pre-filled email — attach the downloaded file and send it to yourself, then import it on the other device.

---

## Calendar events

Calendar events sync separately and continuously via [Google Calendar sync](google-calendar-sync.md) — connect each device once with the same Client ID and they all pull from the same calendars.

---

[← Back to README](../README.md)
