# Google Calendar Sync

The Calendar tool can pull events from Google Calendar in three ways. **Private sync (Method 1) is recommended**: nothing is made public and no files need to be exported.

All synced events flow into the shared TaskStore, so they show up in the Calendar tool, the Day Planner and the unified scheduler.

---

## Method 1 — Private sync via the Google Calendar API (recommended)

Your browser talks directly to Google using OAuth. You sign in with a popup, your calendar stays private, and only this app running in *your* browser can read the events. You only need to set this up **once per Google account** — the same Client ID also powers [Google Drive backup](sync-across-devices.md).

### Step A — Create a (free) Google Cloud OAuth Client ID

You need a **Client ID** only — no API key, no billing.

1. Open the [Google Cloud Console](https://console.cloud.google.com/) and sign in with your Google account.
2. Click the project selector (top bar) → **New project** → name it e.g. `adhd-tools` → **Create**, and make sure it is selected.
3. Search for **Google Calendar API** in the top search bar and click **Enable**.
   *If you also want Google Drive backup, enable the **Google Drive API** the same way.*
4. Search for **Google Auth Platform** (or go to **APIs & Services → OAuth consent screen**) and click **Get started**. The configuration wizard asks for:
   - **App Information** — app name (e.g. `ADHD Tools`) and your email as support email → **Next**.
   - **Audience** — choose **External** → **Next**. (Your app stays in "Testing" mode — no verification needed.)
   - **Contact Information** — your email → **Next**, agree to the policy → **Create**.
5. In the left sidebar open **Clients** → **Create client**:
   - Application type: **Web application**.
   - Under **Authorized JavaScript origins** add:
     - `https://jobellet.github.io` (to use the hosted app)
     - `http://localhost:8422` (only if you run the app locally; adapt the port)
   - Leave *Authorized redirect URIs* empty — the app uses the token flow which doesn't need one.
   - Click **Create** and copy the **Client ID** (it ends in `.apps.googleusercontent.com`).
6. In the left sidebar open **Audience**, scroll to **Test users** → **Add users** and add **your own Google email**. (While the app is in "Testing" mode only test users can sign in — that's you, and it's all you need.)

> Google occasionally reshuffles this console UI. If your screens differ, the goal is always the same: an **External** consent screen in Testing mode, a **Web application** OAuth client with your app origins, and yourself as a **test user**.

### Step B — Connect the app

1. Open the **Settings** tab and expand **Calendar Notifications & Google Sync**.
2. In the **Google Calendar API** box, paste your Client ID and click **Save**. (You can also paste the whole JSON file downloaded from Google — the ID is extracted automatically.)
3. In the **Google Calendar Sync (private)** box, click **Connect & Sync**.
4. A Google popup opens: pick your account and allow access. *(You will see an "unverified app" warning because it is your own test app — click "Continue".)*
5. Your events appear in the Calendar and Day Planner. 🎉

### Options

- **Calendars to sync** — after the first sync, all your calendars are listed with checkboxes; only checked ones are synced (default: primary).
- **Days back / Days ahead** — how far around today the sync window reaches (default 7 back, 30 ahead).
- **Sync now** — re-fetches at any time. The app also re-syncs automatically when you reload during the same browser session.
- **Disconnect** — revokes the token. Already-synced events stay until you clear them.

### Privacy & security notes

- Your Client ID is stored only in your browser's localStorage; it is not a secret (it identifies the app, not you).
- Access tokens are kept in sessionStorage and vanish when the browser closes.
- Events are stored locally in your browser like all other app data — nothing is sent to any server other than Google itself.
- Events deleted on Google are not auto-removed locally (yet); clear the calendar in the app to purge stale entries.

### Exporting to Google Calendar

When connected, small "export" buttons appear on Day Planner time blocks and tasks to push them to your primary Google Calendar as events.

---

## Method 2 — Import an .ics file (offline, no account setup)

1. Export your calendar as an `.ics` file. In **Google Calendar**: **Settings → Import & export → Export** downloads a ZIP with your calendars; extract the `.ics`.
2. Open the **Calendar** tool and click **Import ICS**.
3. Select the file — events appear in the list and are stored locally.

Imported events are converted into TaskStore entries using deterministic hashes (ICS UID + start time), so re-imports don't duplicate. `[FIX]` / `[FLEX]` tags in event titles control whether the scheduler treats them as fixed or movable blocks. Only simple events are supported; nothing is uploaded anywhere.

---

## Method 3 — Public ICS link (simplest, but public)

> ⚠️ **Privacy risk:** anyone who has this link can read your full calendar. Prefer Method 1.

1. In **Google Calendar** open **Settings** and choose your calendar under **Settings for my calendars**.
2. Under **Access permissions for events** check **Make available to public**.
3. Go to **Integrate calendar** and copy the **Public address in iCal format**.
4. In the Calendar tool paste this link into the **ICS URL** field and click **Load**. Events refresh automatically (default: every 30 seconds).

To revoke access later, uncheck **Make available to public**, or use **Reset private URLs** to invalidate the old link.

---

[← Back to README](../README.md)
