# Talk to your planner with your AI assistant (MCP)

Tell your AI assistant (Mistral, Claude or any app that supports **MCP**) things like:

> *"What is left today?"* · *"Split my tax report into small steps."* · *"Put 'call the bank' tomorrow at 10."*

The assistant reads your day and changes your tasks. You see the result in the app a few minutes later.

**Your Google Drive is the storage.** There is no server of ours, and you don't need ngrok, Tailscale or a computer that stays on.

## How it works

```
 AI assistant ──MCP──► ADHD Tools MCP server ──► your Google Drive (private app folder) ◄── the app (browser)
                       (runs on your computer)     • backup   (written by the app)
                                                   • inbox    (written by the MCP server)
```

1. The app already backs up your data to a **private app folder** in your Google Drive (see [Sync across devices](sync-across-devices.md)).
2. The MCP server **reads** that backup to answer the assistant: tasks, routines, calendar events and the plan of the day.
3. When the assistant changes something, the server **does not** touch the backup. It writes the change to a second file, the **inbox**.
4. While the app is open, it reads the inbox (at start, when you come back to it, and every 2 minutes). It applies each change once, with the same rules as when you add a task yourself. Nothing is ever booked on top of something else: if the time was taken in the meantime, the task moves to the next free time.
5. The app then backs up again, so the assistant sees that its change is done.

The server uses the app's own code (the same scheduler and the same task model), so it follows the same rules.

## What you need

- The app connected to Google: a **Google Client ID** in *More → Settings → Calendar Notifications & Google Sync*, and at least one **Back up now** in *More → About → Sync Across Devices*. Keep **Automatic sync** on.
- [Node.js](https://nodejs.org) 18 or newer on the computer where your AI app runs.
- This repository on that computer: `git clone https://github.com/jobellet/ADHDtools.git` (no `npm install` needed; the server uses only Node).

## Step 1 — A "Desktop" sign-in for the server

The server needs its own Google sign-in. It must be in the **same Google Cloud project** as the Client ID the app uses: Google only shares the private app folder inside one project.

1. Open [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials) and pick the project of your app's Client ID.
2. **Create credentials → OAuth client ID → Application type: Desktop app** → Create. Copy the **Client ID** and the **Client secret**.
3. **OAuth consent screen → Audience (or "Publishing status")**: click **Publish app** (*In production*). If you stay in *Testing*, Google stops the sign-in after 7 days. The only scope used (`drive.appdata`, "the app's own configuration data") usually needs no review by Google.

## Step 2 — Sign in once

```bash
cd ADHDtools
npm run mcp:auth -- --client-id "YOUR_DESKTOP_CLIENT_ID" --client-secret "YOUR_CLIENT_SECRET"
```

A Google page opens. Accept, and the terminal says `Connected. Found the app backup from …`.
The key is saved in `~/.config/adhd-tools-mcp/credentials.json`, which only you can read.

If it says *no app backup found*: make a **Back up now** in the app, and check that both Client IDs are in the same project.

## Step 3 — Add the server to your AI app

### Apps that start MCP servers on your computer

This covers LM Studio (it can run Mistral models on your own computer), Claude Desktop, Cursor and others. Add this to the app's MCP settings, with the real path to the folder:

```json
{
  "mcpServers": {
    "adhd-tools": {
      "command": "node",
      "args": ["/full/path/to/ADHDtools/mcp/server.js"]
    }
  }
}
```

Use `node …/server.js`, not `npm run mcp`: npm writes extra text that confuses the AI app.

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
3. In Le Chat, add a custom MCP connector with the address `https://YOUR-HOST/mcp/YOUR_ADHD_MCP_TOKEN`. If the app lets you set a header instead, use `https://YOUR-HOST/mcp` with `Authorization: Bearer YOUR_ADHD_MCP_TOKEN`.

Keep that address secret: anyone who has it can read and change your tasks.

## Step 4 — Try it

- *"Give me an overview of my day."*
- *"Add 'send the invoice', 20 minutes, important, due Friday."*
- *"My tax report is too big. Break it into steps of 15 to 30 minutes."*
- *"When do I have an hour free tomorrow? Put 'read the article' there."*

Then open the app. The changes appear within about 2 minutes, with a short message: *"Your assistant made 3 change(s)."*

## Tools the assistant gets

| Tool | What it does |
| --- | --- |
| `get_overview` | Date and time now, current and next item, counts, day settings, changes still waiting for the app |
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
- **The assistant sees the last backup.** The app backs up after the assistant's changes, when you leave the tab, and once a day. Very fresh edits may not be visible to the assistant yet.
- **Nothing is lost if the app is closed.** Changes wait in the inbox for up to 30 days.
- **Privacy:** API keys and Client IDs are never in the backup. The server only asks Google for the app's private folder (`drive.appdata`). It can't see your other Drive files.
- **Local test without Google:** `ADHD_MCP_DATA_DIR=/some/folder node mcp/server.js` reads `adhd-tools-hub-backup.json` (an *Export Data* file renamed) from that folder, and writes the inbox there.

## Troubleshooting

| Message | Fix |
| --- | --- |
| *Not connected to Google Drive yet* | Do step 2. |
| *Google sign-in failed (invalid_grant)* | The sign-in expired (7 days in *Testing* mode, or access removed). Publish the app (step 1.3) and do step 2 again. |
| *No app backup found* | Tap **Back up now** in the app; check that both Client IDs are in the same Google Cloud project. |
| Changes never show in the app | Keep the app open and tap **Back up now** once; check that **Automatic sync** is on. |
| *That time is taken by …* | This is on purpose: nothing is booked on top of something else. Use the free time the answer gives. |

---

[← Back to README](../README.md) · For developers: [mcp/AGENTS.md](../mcp/AGENTS.md)
