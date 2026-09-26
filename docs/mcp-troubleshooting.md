# AI assistant (MCP) setup: fixing problems

Each section below starts with **what you see** on your screen, so you can recognise it. Look for the words you see, or press **Ctrl+F** (**⌘+F** on a Mac) and search for a few words of the message.

Setup guide: [docs/mcp.md](mcp.md).

**Jump to:**
[In the app](#in-the-app) ·
[In Google Cloud Console](#in-google-cloud-console) ·
[When you sign in (`npm run mcp:auth`)](#when-you-sign-in-npm-run-mcpauth) ·
[In your AI app](#in-your-ai-app) ·
[Later, while you use it](#later-while-you-use-it)

---

## In the app

<a name="no-client-id"></a>
### "Needs a Google Client ID"

**Where:** in the app, *More → About → Sync Across Devices*.
**Why:** the app is not connected to Google yet.
**Fix:** follow [Google Calendar sync, Step A](google-calendar-sync.md#step-a--create-a-free-google-cloud-oauth-client-id). It creates the *Web application* client that the app uses. Then paste its Client ID in *More → Settings → Calendar Notifications & Google Sync*.

<a name="origin-mismatch"></a>
### "Error 400: origin_mismatch" or "redirect_uri_mismatch" (when you connect in the app)

**Where:** a Google page that opens when you tap **Connect** or **Back up now** in the app.
**Why:** Google does not know the web address of the app.
**Fix:** open [Google Auth Platform → Clients](https://console.cloud.google.com/auth/clients), click your **Web application** client, and under **Authorized JavaScript origins** add `https://jobellet.github.io` (no slash at the end). Save, wait 5 minutes, try again.
(If you see this error in the **terminal** instead, read [redirect_uri_mismatch during sign-in](#redirect-uri-mismatch).)

<a name="popup-blocked"></a>
### Nothing happens when I tap "Back up now"

**Why:** the browser blocked the Google sign-in window.
**Fix:** allow pop-ups for the app's site (an icon in the address bar), then tap **Back up now** again.

<a name="drive-api-disabled"></a>
### "Backup failed: Drive API 403" or "Google Drive API has not been used in project … or it is disabled"

**Where:** in the app (*About*), or in the terminal after `npm run mcp:auth`.
**Why:** the **Google Drive API** is not turned on in your Google Cloud project.
**Fix:** open [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com), check that your project is selected at the top, and click **Enable**. Wait 2 minutes, then try again.

---

## In Google Cloud Console

<a name="wrong-project"></a>
### I can't find my client, or I'm not sure which project I'm in

**Why:** Google Cloud can have several projects. The app's client and the assistant's client **must be in the same project**. Only then can both see the same private Drive folder.
**Fix:** click the project name at the top left (next to *Google Cloud*) and choose the project that holds your **Web application** client (in [Clients](https://console.cloud.google.com/auth/clients) you see both clients side by side).

<a name="find-clients"></a>
### I can't find "Credentials" or "Create OAuth client ID"

**Why:** Google renamed the menus. It is now called **Google Auth Platform**.
**Fix:** open [Google Auth Platform → Clients](https://console.cloud.google.com/auth/clients) and click **+ Create client**. If Google asks you to "Get started" first, follow [Google Calendar sync, Step A](google-calendar-sync.md#step-a--create-a-free-google-cloud-oauth-client-id) steps 4–5.

<a name="client-secret"></a>
### I can't see the Client secret any more

**Why:** Google shows a new secret only once, when you create it.
**Fix:** in [Clients](https://console.cloud.google.com/auth/clients), click your **Desktop** client → **Add secret**, and copy the new secret now. (You can delete the old one.)

<a name="publish-greyed-out"></a>
### "Publish app" is greyed out: "Valid app name, support email, homepage URL and privacy policy URL are required…"

**Where:** *Google Auth Platform → Audience*.
**Why:** Google wants a few details about the app before it can leave *Testing*.

You have two choices:

**Choice A — skip publishing (fastest).** You don't have to publish. In *Testing*, the assistant works the same, but Google asks you to sign in again **every 7 days**. Signing in again takes one command: `npm run mcp:auth`. Check that your email is in **Audience → Test users** ([fix](#access-blocked-test-user)), then go on with [step 2 of the guide](mcp.md#step-2--sign-in-once).

**Choice B — fill in the details, then publish (no weekly sign-in).**
1. Open [Google Auth Platform → Branding](https://console.cloud.google.com/auth/branding).
2. Fill in:
   - **App name:** for example `ADHD Tools (personal)`.
   - **User support email:** your own email.
   - **Application home page:** `https://jobellet.github.io/ADHDtools/`
   - **Application privacy policy link:** `https://github.com/jobellet/ADHDtools/blob/main/docs/privacy.md`
   - **Authorized domains:** add `jobellet.github.io` and `github.com`.
   - **Developer contact information:** your own email.
3. Click **Save** at the bottom.
4. Go back to [Audience](https://console.cloud.google.com/auth/audience) → **Publish app** → **Confirm**.

If Google then asks for verification, read [Google asks me to verify the app](#verification-required).

<a name="verification-required"></a>
### Google asks me to verify the app ("Prepare for verification", "needs verification")

**Why:** Google reviews apps that many people use. Your project also has the app's Calendar access, which Google calls "sensitive".
**Fix:** for personal use you don't need to send anything to Google. After publishing you will see a ["Google hasn't verified this app"](#unverified-warning) page when you sign in: that is fine. If Google does not let you publish without a review, click **Audience → Back to testing** and use [Choice A](#publish-greyed-out).

<a name="make-internal"></a>
### Should I click "Make internal"?

No. *Internal* only works for company Google Workspace accounts. Keep **External**.

---

## When you sign in (`npm run mcp:auth`)

<a name="node-version"></a>
### "command not found: npm" / "node", "fetch is not defined", or "SyntaxError: Unexpected token '||='"

**Why:** Node.js is missing or too old (you need version 18 or newer).
**Fix:** install the **LTS** version from [nodejs.org](https://nodejs.org), close the terminal, open a new one, and check with `node --version`.

<a name="auth-usage"></a>
### "Usage: npm run mcp:auth -- --client-id <ID> --client-secret <SECRET>"

**Why:** the command needs your Desktop client's ID and secret the first time. (Later, `npm run mcp:auth` alone reuses them.)
**Fix:** copy both from [Clients](https://console.cloud.google.com/auth/clients) → your **Desktop** client, and keep the `--` after `mcp:auth`:
```bash
npm run mcp:auth -- --client-id "123-abc.apps.googleusercontent.com" --client-secret "GOCSPX-…"
```
Run it inside the `ADHDtools` folder (`cd ADHDtools` first).

<a name="browser-did-not-open"></a>
### No browser page opens

**Fix:** the terminal shows a long link starting with `https://accounts.google.com/`. Copy all of it and open it in your browser, **on the same computer**.

<a name="access-blocked-test-user"></a>
### "Access blocked: … has not completed the Google verification process" / "Error 403: access_denied"

**Where:** the Google page that opens during sign-in.
**Why:** the app is in *Testing*, and this Google account is not in the list of test users. Or you picked another Google account.
**Fix:** open [Audience](https://console.cloud.google.com/auth/audience) → **Test users** → **+ Add users**, and add the email you sign in with. Save, then run the command again. On the Google page, pick **the same account you use in the app**.

<a name="unverified-warning"></a>
### "Google hasn't verified this app"

**Why:** this is your own app, and Google has not reviewed it. That is normal.
**Fix:** click **Advanced** → **Go to … (unsafe)** → **Continue**. You are giving access to yourself.

<a name="redirect-uri-mismatch"></a>
### "Error 400: redirect_uri_mismatch" (during `npm run mcp:auth`)

**Why:** you used the **Web application** client (the app's one). The assistant needs a **Desktop app** client.
**Fix:** in [Clients](https://console.cloud.google.com/auth/clients) click **+ Create client** → **Application type: Desktop app** → **Create**, and use *that* Client ID and secret.

<a name="invalid-client"></a>
### "invalid_client: The OAuth client was not found" or "Unauthorized"

**Why:** the Client ID or the secret is not right (a missing character, a space, or the secret of another client), or the client was deleted.
**Fix:** copy both again from [Clients](https://console.cloud.google.com/auth/clients) → your **Desktop** client. Put each one in quotes. If you can't see the secret, read [I can't see the Client secret](#client-secret).

<a name="auth-timeout"></a>
### "This site can't be reached (127.0.0.1)" or "timed out after 5 minutes"

**Why:** after you click **Continue**, Google sends you back to a small page that the command opens on your computer. That page only exists while the command runs (5 minutes).
**Fix:** run `npm run mcp:auth …` again, keep the terminal open, and finish the Google page within 5 minutes. Open the link on the **same computer** as the terminal.

<a name="no-refresh-token"></a>
### "Google did not return a refresh token"

**Why:** Google sometimes skips it when you already gave access earlier.
**Fix:** open [your Google account → Third-party connections](https://myaccount.google.com/connections), remove your app, then run the command again.

<a name="no-backup"></a>
### "Connected, but no app backup found yet"

**Why:** one of three things:
1. The app has not backed up yet.
2. You signed in with another Google account.
3. The Desktop client is in **another Google Cloud project** than the app's Web client.

**Fix:**
1. In the app: *More → About → Sync Across Devices → Back up now*.
2. Sign in with the account you use in the app.
3. Check the project: see [which project am I in](#wrong-project).

Then run `npm run mcp:auth` again.

---

## In your AI app

<a name="server-not-listed"></a>
### The AI app does not show the ADHD Tools tools, or says "failed to start" / "spawn node ENOENT"

**Why:** the AI app can't find `node` or `server.js`. Apps started from the Dock or Start menu often don't see the same programs as your terminal.
**Fix:**
1. In the terminal, run `which node` (Mac/Linux) or `where node` (Windows) and put that **full path** as `"command"`.
2. Use the **full path** to `mcp/server.js` in `"args"`. Find it with `pwd` inside the `ADHDtools` folder.
3. Quit the AI app completely and open it again.

Example (Mac):
```json
{ "mcpServers": { "adhd-tools": { "command": "/opt/homebrew/bin/node", "args": ["/Users/you/ADHDtools/mcp/server.js"] } } }
```
Test it by hand: `node /full/path/to/ADHDtools/mcp/server.js` should print `ready (stdio)` and wait (stop it with Ctrl+C).

<a name="npm-in-config"></a>
### "Unexpected token '>'", "invalid JSON", or the server stops at once

**Why:** the AI app starts `npm run mcp`. npm writes extra lines, and the AI app can't read them.
**Fix:** use `node` + the path to `server.js` (see above), not `npm`.

<a name="windows-paths"></a>
### Windows: the path does not work

**Fix:** in the JSON, write paths with `/` or double `\\`, for example `"C:/Users/you/ADHDtools/mcp/server.js"`.

<a name="le-chat-401"></a>
### Le Chat (web): "401", "unauthorized" or the connector does not connect

**Why:** the address must contain your secret token, and the server must be reachable over **https**.
**Fix:** use `https://YOUR-HOST/mcp/YOUR_ADHD_MCP_TOKEN` (the same token as the `ADHD_MCP_TOKEN` setting on the host). Open `https://YOUR-HOST/health` in a browser: it must show `ok`. See [Le Chat setup](mcp.md#le-chat-mistral-on-the-web-or-phone-and-other-web-apps).

---

## Later, while you use it

<a name="not-connected"></a>
### "Not connected to Google Drive yet"

**Fix:** do [step 2 of the guide](mcp.md#step-2--sign-in-once) (`npm run mcp:auth`) on the computer where the server runs.

<a name="invalid-grant"></a>
### "Google sign-in failed (invalid_grant)"

**Why:** the sign-in expired. In *Testing* mode this happens every 7 days. It also happens if you removed the access in your Google account.
**Fix:** run `npm run mcp:auth` in the `ADHDtools` folder (no ID or secret needed: it reuses the saved ones). To stop this weekly step, [publish the app](#publish-greyed-out) (Choice B).

<a name="changes-not-showing"></a>
### The assistant says "Queued", but nothing changes in the app

**Why:** the app applies changes only while it is **open** and **signed in to Google** in that tab. Google gives the browser one hour at a time.
**Fix:**
1. Open the app.
2. Tap *More → About → Sync Across Devices → Back up now*. This signs in again and applies what is waiting.
3. Check that **Automatic sync** is on (same place).
4. Check that the app and the assistant use **the same Google account**.

<a name="assistant-sees-old-data"></a>
### The assistant does not see a task I just added in the app

**Why:** the assistant reads the last backup. The app backs up when you leave the tab, after the assistant's changes, and once a day.
**Fix:** tap **Back up now**, or switch to another tab and back, then ask again.

<a name="time-taken"></a>
### "That time is taken by …"

This is on purpose: nothing is ever booked on top of something else. The answer gives the next free time; say yes to it, or pick another time.

<a name="drive-error"></a>
### "Could not reach your data: Google Drive 4xx/5xx"

**Fix:** 403 → see [Drive API is off](#drive-api-disabled). 401 → [sign in again](#invalid-grant). 5xx → Google had a short problem; try again in a minute.

---

Still stuck? [Open an issue](https://github.com/jobellet/ADHDtools/issues/new) with the exact message (remove any secret or token first).

[← Setup guide](mcp.md) · [← README](../README.md)
