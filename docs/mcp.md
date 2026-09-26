# Talk to your planner with your AI assistant (MCP)

Tell your AI assistant (Mistral, Claude or any app that supports **MCP**) things like:

> *"What is left today?"* · *"Split my tax report into small steps."* · *"Put 'call the bank' tomorrow at 10."*

The assistant reads your day and changes your tasks. You see the result in the app a few minutes later.

**Your Google Drive is the storage.** There is no server of ours, and you don't need ngrok, Tailscale or a computer that stays on.

Something goes wrong? Each step has a **Stuck?** box with links to the fix for each message you may see. All fixes are on one page: [Fixing problems](mcp-troubleshooting.md).

## How it works

```
 AI assistant ──MCP──► ADHD Tools MCP server ──► your Google Drive (private app folder) ◄── the app (browser)
                       (runs on your computer)     • backup   (written by the app)
                                                   • inbox    (written by the MCP server)
```

1. The app backs up your data to a **private app folder** in your Google Drive (see [Sync across devices](sync-across-devices.md)).
2. The MCP server **reads** that backup to answer the assistant: tasks, routines, calendar events and the plan of the day.
3. When the assistant changes something, the server **does not** touch the backup. It writes the change to a second file, the **inbox**.
4. While the app is open, it reads the inbox (at start, when you come back to it, and every 2 minutes). It applies each change once, with the same rules as when you add a task yourself. Nothing is ever booked on top of something else: if the time was taken in the meantime, the task moves to the next free time.
5. The app then backs up again, so the assistant sees that its change is done.

## Before you start (5 minutes)

You need three things:

- **The app connected to Google Drive.** In the app: *More → About → Sync Across Devices → Back up now*. You should see *"Backup saved to your Google Drive"*. Keep **Automatic sync** on.
  > **Stuck?** "Needs a Google Client ID" → [no Client ID yet](mcp-troubleshooting.md#no-client-id) · "origin_mismatch" → [add the app's address](mcp-troubleshooting.md#origin-mismatch) · nothing happens → [pop-up blocked](mcp-troubleshooting.md#popup-blocked) · "Drive API 403" → [turn on the Drive API](mcp-troubleshooting.md#drive-api-disabled)
- **Node.js 18 or newer** on the computer where your AI app runs. Check: `node --version`.
  > **Stuck?** "command not found" or an old version → [install Node.js](mcp-troubleshooting.md#node-version)
- **This project on that computer:**
  ```bash
  git clone https://github.com/jobellet/ADHDtools.git
  cd ADHDtools
  ```
  (No `npm install` is needed: the server uses only Node. Without git, use **Code → Download ZIP** on GitHub and unzip it.)

## Step 1 — Make a "Desktop" client in Google Cloud (5 minutes)

The server needs its own Google sign-in, a **Desktop app** client. It must be in the **same Google Cloud project** as the app's Web client: Google only shares the private app folder inside one project.

1. Open [Google Auth Platform → Clients](https://console.cloud.google.com/auth/clients).
2. At the top left, check the **project name**. It must be the project where you see your **Web application** client (the one the app uses).
3. Click **+ Create client** → **Application type: Desktop app** → name it `ADHD Tools assistant` → **Create**.
4. Copy the **Client ID** and the **Client secret** now (for example into a note). Google shows the secret only once.
5. Open [Audience](https://console.cloud.google.com/auth/audience) → **Test users** → check that **your own email** is in the list (add it with **+ Add users** if not).

> **Stuck?** Can't find "Clients" or "Credentials" → [where the menus are now](mcp-troubleshooting.md#find-clients) · not sure about the project → [which project](mcp-troubleshooting.md#wrong-project) · secret not shown → [make a new secret](mcp-troubleshooting.md#client-secret) · "Make internal"? → [no, keep External](mcp-troubleshooting.md#make-internal)

### Optional: publish, so you don't sign in again every week

While the project is in **Testing**, Google stops the assistant's sign-in after **7 days**. Then you run one command again ([step 2](#step-2--sign-in-once)). That's fine to start with, so **you can skip this part**.

To stop the weekly sign-in:
1. Open [Branding](https://console.cloud.google.com/auth/branding) and fill in:
   - **App name:** `ADHD Tools (personal)`; **User support email** and **Developer contact:** your email.
   - **Application home page:** `https://jobellet.github.io/ADHDtools/`
   - **Application privacy policy link:** `https://github.com/jobellet/ADHDtools/blob/main/docs/privacy.md`
   - **Authorized domains:** `jobellet.github.io` and `github.com`.
   - Click **Save**.
2. Open [Audience](https://console.cloud.google.com/auth/audience) → **Publish app** → **Confirm**.

> **Stuck?** "Publish app" is greyed out ("Valid app name, support email, homepage URL and privacy policy URL are required") → [fill in Branding, or skip](mcp-troubleshooting.md#publish-greyed-out) · Google asks for verification → [what to do](mcp-troubleshooting.md#verification-required)

## Step 2 — Sign in once

In a terminal, inside the `ADHDtools` folder, paste your Desktop client's ID and secret:

```bash
npm run mcp:auth -- --client-id "YOUR_DESKTOP_CLIENT_ID" --client-secret "YOUR_CLIENT_SECRET"
```

1. A Google page opens. Choose **the same Google account you use in the app**.
2. If Google says *"Google hasn't verified this app"*: click **Advanced → Go to … (unsafe)**. It is your own app.
3. Click **Continue**. The page says *"Done"*.
4. The terminal says **`Connected. Found the app backup from …`**. You're done with Google.

The sign-in key is saved in `~/.config/adhd-tools-mcp/credentials.json`, which only you can read. Never share this file, and don't paste your Client secret in chats ([if you did](mcp-troubleshooting.md#secret-shared)). **To sign in again later** (for example after 7 days in Testing), just run `npm run mcp:auth`: it reuses the saved ID and secret.

> **Stuck?** "Usage: npm run mcp:auth …" → [how to type the command](mcp-troubleshooting.md#auth-usage) · no page opens → [open the link yourself](mcp-troubleshooting.md#browser-did-not-open) · "Access blocked" / "Error 403: access_denied" → [add yourself as test user](mcp-troubleshooting.md#access-blocked-test-user) · "Google hasn't verified this app" → [it's normal](mcp-troubleshooting.md#unverified-warning) · "redirect_uri_mismatch" → [use a Desktop client](mcp-troubleshooting.md#redirect-uri-mismatch) · "invalid_client" → [ID or secret wrong](mcp-troubleshooting.md#invalid-client) · "This site can't be reached (127.0.0.1)" or "timed out" → [run it again](mcp-troubleshooting.md#auth-timeout) · "did not return a refresh token" → [remove old access](mcp-troubleshooting.md#no-refresh-token) · "no app backup found" → [back up / same account / same project](mcp-troubleshooting.md#no-backup) · "Drive API … disabled" → [turn on the Drive API](mcp-troubleshooting.md#drive-api-disabled)

## Step 3 — Add the server to your AI app

### Apps that start MCP servers on your computer

This covers LM Studio (it can run Mistral models on your own computer), Claude Desktop, Cursor and others. Add this to the app's MCP settings. Use **full paths**: find `node` with `which node` (Windows: `where node`) and the folder with `pwd` inside `ADHDtools`.

```json
{
  "mcpServers": {
    "adhd-tools": {
      "command": "/full/path/to/node",
      "args": ["/full/path/to/ADHDtools/mcp/server.js"]
    }
  }
}
```

Quit the AI app completely and open it again. Its tool list should show `get_overview`, `add_task` and the others.

> **Stuck?** No tools, "failed to start" or "spawn node ENOENT" → [full paths and restart](mcp-troubleshooting.md#server-not-listed) · "Unexpected token" / "invalid JSON" → [don't use npm in the config](mcp-troubleshooting.md#npm-in-config) · Windows paths → [use / in paths](mcp-troubleshooting.md#windows-paths)

### Mistral Vibe (terminal)

Add this to `~/.vibe/config.toml` (check Vibe's documentation if the format has changed):

```toml
[[mcp_servers]]
name = "adhd-tools"
transport = "stdio"
command = "node"
args = ["/full/path/to/ADHDtools/mcp/server.js"]
```

### Le Chat (Mistral on the web or phone) and other web apps

A web app can't start a program on your computer: it needs the server at an **https** address. This part can't be avoided, but you don't need ngrok or Tailscale. Run the server on any small Node host (for example Google Cloud Run, Render or Fly.io, often free for this use):

1. On your computer, sign in and print the settings: `npm run mcp:auth -- --client-id … --client-secret … --print-env`
2. On the host, start `node mcp/server.js http` with these environment variables:
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`: from step 1.
   - `ADHD_MCP_TOKEN`: a long random secret, for example the output of `openssl rand -hex 24`.
   - `ADHD_TZ`: your time zone, for example `Europe/Paris`. Without it, "today" is the server's day.
   - `HOST=0.0.0.0` and `PORT`, if the host asks for them.
3. Check that `https://YOUR-HOST/health` shows `ok`.
4. In Le Chat, add a custom MCP connector with the address `https://YOUR-HOST/mcp/YOUR_ADHD_MCP_TOKEN`. If the app lets you set a header instead, use `https://YOUR-HOST/mcp` with `Authorization: Bearer YOUR_ADHD_MCP_TOKEN`.

Keep that address secret: anyone who has it can read and change your tasks.

> **Stuck?** "401" / the connector does not connect → [check the address and token](mcp-troubleshooting.md#le-chat-401)

## Step 4 — Check everything

In the `ADHDtools` folder:

```bash
git pull              # get the latest version
npm run mcp:check     # tests Node, Google, your backup, the AI app's config, and starts the server like the AI app does
```

Each line with a **✗** comes with a **Fix:** link. When all lines show **✓**: quit the AI app completely, open it again, and start a new **text** chat.

> **Stuck?** The AI says it can't find or use the tools → [tools not usable in this chat](mcp-troubleshooting.md#ai-cant-see-tools) · worked before, not after a Node update → [node path changed](mcp-troubleshooting.md#node-path-changed) · you shared your Client secret → [change it](mcp-troubleshooting.md#secret-shared)

## Step 5 — Try it

- *"Use the adhd-tools tool get_overview: what are my next events?"*
- *"Give me an overview of my day."*
- *"Add 'send the invoice', 20 minutes, important, due Friday."*
- *"My tax report is too big. Break it into steps of 15 to 30 minutes."*
- *"When do I have an hour free tomorrow? Put 'read the article' there."*

Then open the app. The changes appear within about 2 minutes, with a short message: *"Your assistant made 3 change(s)."*

> **Stuck?** "Not connected to Google Drive yet" → [sign in](mcp-troubleshooting.md#not-connected) · "invalid_grant" → [sign in again](mcp-troubleshooting.md#invalid-grant) · "Queued" but nothing in the app → [open the app, Back up now](mcp-troubleshooting.md#changes-not-showing) · the assistant doesn't see a new task → [it reads the last backup](mcp-troubleshooting.md#assistant-sees-old-data) · "That time is taken" → [on purpose](mcp-troubleshooting.md#time-taken) · "Google Drive 4xx/5xx" → [Drive errors](mcp-troubleshooting.md#drive-error)

## Tools the assistant gets

| Tool | What it does |
| --- | --- |
| `get_overview` | Date and time now, current and next item, next calendar events and fixed tasks (7 days), counts, day settings, changes still waiting for the app |
| `list_tasks` | Tasks: pending, overdue, done or all, with search |
| `get_schedule` | The plan of a day: routines (with buffer), events, fixed tasks, and today's auto-placed tasks |
| `find_free_slots` | Free windows of a day that fit a given length |
| `list_routines` | Routines, their steps and the time they book |
| `add_task` | Add a task (the app places it), or give it a fixed time (refused if the time is taken) |
| `update_task` | Change name, length, importance, urgency, deadline, time, notes or place |
| `schedule_task` | Give a task a fixed time (refused if taken; the answer gives the next free time) |
| `complete_task` | Mark a task as done |
| `delete_task` | Delete a task on every device (the assistant is told to ask you first) |
| `break_down_task` | Split a big task into ordered steps; the big task is archived |

Routines, habits, rewards and settings are changed in the app only.

## Good to know

- **The app must be open** to apply changes, and signed in to Google in that tab. Google gives the browser one hour of access at a time. After that, tap **Back up now** (*More → About*): it signs in again and applies what is waiting.
- **The assistant sees the last backup.** The app backs up after the assistant's changes, when you leave the tab, and once a day.
- **Nothing is lost if the app is closed.** Changes wait in the inbox for up to 30 days.
- **Privacy:** API keys and Client IDs are never in the backup. The server only asks Google for the app's private folder (`drive.appdata`). It can't see your other Drive files. See the [privacy policy](privacy.md).
- **Local test without Google:** `ADHD_MCP_DATA_DIR=/some/folder node mcp/server.js` reads `adhd-tools-hub-backup.json` (an *Export Data* file renamed) from that folder, and writes the inbox there.

---

[← Back to README](../README.md) · [Fixing problems](mcp-troubleshooting.md) · For developers: [mcp/AGENTS.md](../mcp/AGENTS.md)
