// auth.js — one-time Google sign-in for the MCP server (OAuth "installed app" flow with PKCE).
// Opens Google in your browser, receives the answer on http://127.0.0.1:<random port>, and saves
// a refresh token in ~/.config/adhd-tools-mcp/credentials.json (only readable by you).
//   node mcp/server.js auth --client-id <ID> --client-secret <SECRET> [--print-env]
// The Client ID must be a "Desktop app" OAuth client in the SAME Google Cloud project as the
// Client ID saved in the web app: only then can both see the same private Drive app folder.
import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { DRIVE_SCOPE, BACKUP_FILENAME, saveCredentials, createDriveStore } from './store.js';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

function arg(args, name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

function openBrowser(url) {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const cmdArgs = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try { spawn(cmd, cmdArgs, { stdio: 'ignore', detached: true }).on('error', () => {}).unref(); } catch { /* print only */ }
}

export async function runAuth(args) {
  const clientId = arg(args, 'client-id') || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = arg(args, 'client-secret') || process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('Usage: npm run mcp:auth -- --client-id <ID> --client-secret <SECRET>\nSee docs/mcp.md, step 2.');
    process.exit(2);
  }
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const state = randomBytes(16).toString('hex');

  const code = await new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname !== '/') { res.writeHead(404).end(); return; }
      const ok = url.searchParams.get('state') === state && url.searchParams.get('code');
      res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8' })
        .end(ok ? '<p>Done. You can close this tab and go back to the terminal.</p>' : `<p>Sign-in failed: ${url.searchParams.get('error') || 'unknown'}.</p>`);
      const redirectUri = server.redirectUri;
      server.close();
      if (ok) resolve({ code: url.searchParams.get('code'), redirectUri });
      else reject(new Error(url.searchParams.get('error') || 'sign-in failed'));
    });
    server.listen(0, '127.0.0.1', () => {
      const redirectUri = `http://127.0.0.1:${server.address().port}`;
      const url = new URL(AUTH_URL);
      Object.entries({
        client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: DRIVE_SCOPE,
        access_type: 'offline', prompt: 'consent', code_challenge: challenge, code_challenge_method: 'S256', state,
      }).forEach(([k, v]) => url.searchParams.set(k, v));
      console.error(`\nOpen this link to let the assistant use the app's private Drive folder:\n\n${url}\n`);
      openBrowser(url.toString());
      server.redirectUri = redirectUri;
    });
    setTimeout(() => { server.close(); reject(new Error('timed out after 5 minutes')); }, 5 * 60_000).unref();
  }).catch(err => { console.error(`Sign-in failed: ${err.message}`); process.exit(1); });

  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code', code: code.code, redirect_uri: code.redirectUri,
      client_id: clientId, client_secret: clientSecret, code_verifier: verifier,
    }),
  });
  const body = await resp.json();
  if (!resp.ok || !body.refresh_token) {
    console.error(`Google did not return a refresh token (${body.error || resp.status}: ${body.error_description || ''}).`);
    process.exit(1);
  }
  const creds = { client_id: clientId, client_secret: clientSecret, refresh_token: body.refresh_token };
  const file = await saveCredentials(creds);
  console.error(`Saved to ${file}`);

  const backup = await createDriveStore(creds).readJson(BACKUP_FILENAME).catch(err => ({ error: err.message }));
  if (backup?.error) console.error(`Warning: could not read Drive: ${backup.error}`);
  else if (!backup) console.error('Connected, but no app backup found yet. In the app: About → Sync Across Devices → Back up now. Check that both Client IDs are in the same Google Cloud project.');
  else console.error(`Connected. Found the app backup from ${backup.data?.metadata?.exportedAt || 'an unknown date'}.`);

  if (args.includes('--print-env')) {
    console.log(`GOOGLE_CLIENT_ID=${clientId}\nGOOGLE_CLIENT_SECRET=${clientSecret}\nGOOGLE_REFRESH_TOKEN=${body.refresh_token}`);
  }
}
