// store.js — where the MCP server reads and writes the app's data.
// Google Drive (default): the same private "appDataFolder" the app backs up to
// (services/drive-sync.js). A local folder (ADHD_MCP_DATA_DIR): for tests and offline use.
// Only two files are touched:
//   BACKUP_FILENAME  written by the app, READ-ONLY here (the MCP server never overwrites it)
//   INBOX_FILENAME   written only by the MCP server; the app reads it and applies the changes
import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

export const BACKUP_FILENAME = 'adhd-tools-hub-backup.json';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export function credentialsPath(env = process.env) {
  return env.ADHD_MCP_CREDENTIALS || join(env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'adhd-tools-mcp', 'credentials.json');
}

export async function saveCredentials(creds, env = process.env) {
  const file = credentialsPath(env);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(creds, null, 2), { mode: 0o600 });
  await chmod(file, 0o600).catch(() => {});
  return file;
}

// Credentials: environment variables win (hosted use), else the file written by `auth`.
export async function loadCredentials(env = process.env) {
  if (env.GOOGLE_REFRESH_TOKEN) {
    return { client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: env.GOOGLE_REFRESH_TOKEN };
  }
  const file = credentialsPath(env);
  if (!existsSync(file)) return null;
  return JSON.parse(await readFile(file, 'utf8'));
}

// ---- local folder -------------------------------------------------------------------------
export function createFileStore(dir) {
  return {
    kind: 'folder',
    describe: () => `local folder ${dir}`,
    async readJson(name) {
      const file = join(dir, name);
      if (!existsSync(file)) return null;
      return { data: JSON.parse(await readFile(file, 'utf8')) };
    },
    async writeJson(name, value) {
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, name), JSON.stringify(value, null, 2));
    },
  };
}

// ---- Google Drive -------------------------------------------------------------------------
export function createDriveStore(creds, { fetchImpl = fetch } = {}) {
  let token = null;
  let tokenExpiresAt = 0;
  const fileIds = new Map();

  async function accessToken() {
    if (token && Date.now() < tokenExpiresAt - 60_000) return token;
    const resp = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: creds.client_id,
        client_secret: creds.client_secret || '',
        refresh_token: creds.refresh_token,
      }),
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(`Google sign-in failed (${body.error || resp.status}). Run "npm run mcp:auth" again.`);
    }
    token = body.access_token;
    tokenExpiresAt = Date.now() + (body.expires_in || 3600) * 1000;
    return token;
  }

  async function api(url, init = {}) {
    const resp = await fetchImpl(url, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${await accessToken()}` } });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`Google Drive ${resp.status}: ${text.slice(0, 200)}`);
    }
    return resp;
  }

  async function findFile(name) {
    if (fileIds.has(name)) return fileIds.get(name);
    const url = new URL(`${DRIVE_API}/files`);
    url.searchParams.set('spaces', 'appDataFolder');
    url.searchParams.set('q', `name = '${name}'`);
    url.searchParams.set('fields', 'files(id, name, modifiedTime)');
    const { files = [] } = await (await api(url)).json();
    const file = files[0] || null;
    if (file) fileIds.set(name, file);
    return file;
  }

  return {
    kind: 'drive',
    describe: () => 'Google Drive (private app folder)',
    async readJson(name) {
      const file = await findFile(name);
      if (!file) return null;
      const resp = await api(`${DRIVE_API}/files/${file.id}?alt=media`);
      return { data: await resp.json() };
    },
    async writeJson(name, value) {
      const payload = JSON.stringify(value);
      const file = await findFile(name);
      if (file) {
        await api(`${DRIVE_UPLOAD}/files/${file.id}?uploadType=media`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: payload,
        });
        return;
      }
      const boundary = `adhdtools${Date.now()}`;
      const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`
        + JSON.stringify({ name, parents: ['appDataFolder'] })
        + `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${payload}\r\n--${boundary}--`;
      const created = await (await api(`${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,name,modifiedTime`, {
        method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body,
      })).json();
      fileIds.set(name, created);
    },
  };
}

export async function createStore(env = process.env) {
  if (env.ADHD_MCP_DATA_DIR) return createFileStore(env.ADHD_MCP_DATA_DIR);
  const creds = await loadCredentials(env);
  if (!creds?.refresh_token) {
    throw new Error(`Not connected to Google Drive yet. Run "npm run mcp:auth" (credentials go to ${credentialsPath(env)}).`);
  }
  return createDriveStore(creds);
}
