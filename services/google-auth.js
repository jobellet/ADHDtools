// google-auth.js — shared Google Identity Services (GIS) helper.
// OAuth token flow only: needs just an OAuth Client ID (no API key).
// Used by services/google-calendar-sync.js (Calendar sync) and services/drive-sync.js (Drive backup).
// Desktop app (Tauri): Google's popup cannot open in the web view, so sign-in runs in the system
// browser (PKCE + loopback redirect) and a refresh token is kept, so the user signs in only once.
(function () {
  const CLIENT_ID_KEY = 'gcalClientId';
  const CLIENT_SECRET_KEY = 'gcalClientSecret'; // desktop app only (Desktop-type OAuth client)
  const REFRESH_TOKEN_KEY = 'gcalRefreshToken'; // desktop app only; mirrored to disk, never exported
  // One consent covers every scope the app uses, so Calendar and Drive share one sign-in.
  const NATIVE_SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
    'https://www.googleapis.com/auth/drive.appdata',
  ].join(' ');
  const TOKEN_URL = 'https://oauth2.googleapis.com/token';
  let mcpClient = null; // Desktop client already set up for the AI assistant (read from disk)
  let mcpClientLoaded = false;
  const TOKEN_CACHE_PREFIX = 'google-token:'; // sessionStorage, cleared when the browser closes
  let gisReadyPromise = null;

  function isNative() {
    return Boolean(window.AttentionService?.isNative?.());
  }

  function getSavedClientId() {
    try {
      return localStorage.getItem(CLIENT_ID_KEY) || '';
    } catch {
      return '';
    }
  }

  function getClientSecret() {
    try {
      return localStorage.getItem(CLIENT_SECRET_KEY) || '';
    } catch {
      return '';
    }
  }

  // Desktop app: the saved Client ID is used only together with a secret; otherwise fall back to the
  // Desktop client already created for the AI assistant (~/.config/adhd-tools-mcp/credentials.json).
  function getClientId() {
    const saved = getSavedClientId();
    if (!isNative() || getClientSecret()) return saved;
    return mcpClient?.clientId || saved;
  }

  async function loadMcpClient() {
    if (mcpClientLoaded || !isNative()) return;
    mcpClientLoaded = true;
    try {
      mcpClient = (await window.AttentionService.invokeNative('native_read_mcp_client')) || null;
    } catch {
      mcpClient = null;
    }
  }

  function setClientId(id) {
    localStorage.setItem(CLIENT_ID_KEY, id);
  }

  function setClientSecret(secret) {
    if (secret) localStorage.setItem(CLIENT_SECRET_KEY, secret);
    else localStorage.removeItem(CLIENT_SECRET_KEY);
  }

  function loadGis() {
    if (window.google?.accounts?.oauth2) return Promise.resolve();
    if (gisReadyPromise) return gisReadyPromise;
    gisReadyPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        gisReadyPromise = null;
        reject(new Error('Failed to load Google Identity Services'));
      };
      document.head.appendChild(s);
    });
    return gisReadyPromise;
  }

  function readCachedToken(scope) {
    try {
      const raw = sessionStorage.getItem(TOKEN_CACHE_PREFIX + scope);
      if (raw) {
        const { token, expiresAt } = JSON.parse(raw);
        // 60s safety margin so we never hand out a token about to expire
        if (token && Date.now() <= expiresAt - 60000) return token;
      }
      // If a superset token (e.g. NATIVE_SCOPES) is cached, reuse it when it covers every requested scope.
      const requested = String(scope || '').split(/\s+/).filter(Boolean);
      if (!requested.length) return null;
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (!k || !k.startsWith(TOKEN_CACHE_PREFIX)) continue;
        const granted = k.slice(TOKEN_CACHE_PREFIX.length).split(/\s+/).filter(Boolean);
        if (!requested.every(s => granted.includes(s))) continue;
        const entry = JSON.parse(sessionStorage.getItem(k) || '{}');
        if (entry.token && Date.now() <= entry.expiresAt - 60000) return entry.token;
      }
      return null;
    } catch {
      return null;
    }
  }

  function cacheToken(scope, token, expiresInSeconds) {
    try {
      const payload = JSON.stringify({
        token,
        expiresAt: Date.now() + (parseInt(expiresInSeconds, 10) || 3600) * 1000,
      });
      sessionStorage.setItem(TOKEN_CACHE_PREFIX + scope, payload);
      // Cache under individual scopes too so Calendar and Drive share one sign-in seamlessly.
      String(scope || '').split(/\s+/).filter(Boolean).forEach(single => {
        sessionStorage.setItem(TOKEN_CACHE_PREFIX + single, payload);
      });
    } catch { /* storage full or blocked — token stays usable for this call */ }
  }


  // ---- Desktop app (native) sign-in ---------------------------------------

  function base64Url(bytes) {
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function randomString(byteCount) {
    return base64Url(crypto.getRandomValues(new Uint8Array(byteCount)));
  }

  async function nativeClient() {
    await loadMcpClient();
    const secret = getClientSecret();
    if (getSavedClientId() && secret) return { clientId: getSavedClientId(), clientSecret: secret };
    if (mcpClient) return mcpClient;
    throw new Error('Desktop/Android app needs an OAuth Client ID and Secret — enter them above in Google Calendar API and click Save.');
  }

  async function postToken(params) {
    const resp = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params),
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const err = new Error(body.error_description || body.error || `Google token error ${resp.status}`);
      err.code = body.error;
      throw err;
    }
    return body;
  }

  async function nativeRefresh(scope) {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return null;
    const { clientId, clientSecret } = await nativeClient();
    try {
      const body = await postToken({
        grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret,
      });
      cacheToken(scope, body.access_token, body.expires_in);
      return body.access_token;
    } catch (err) {
      if (err.code === 'invalid_grant') localStorage.removeItem(REFRESH_TOKEN_KEY); // revoked or expired: sign in again
      else if (err.code === 'invalid_client') throw err;
      return null; // offline or temporary error: try again on the next sync
    }
  }

  async function nativeSignIn(scope) {
    const invoke = window.AttentionService.invokeNative;
    const { clientId, clientSecret } = await nativeClient();
    const port = await invoke('native_oauth_listen');
    if (!port) throw new Error('Could not start the local sign-in listener');
    const redirectUri = `http://127.0.0.1:${port}`;
    const verifier = randomString(48);
    const state = randomString(16);
    const challenge = base64Url(new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    Object.entries({
      client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: NATIVE_SCOPES,
      code_challenge: challenge, code_challenge_method: 'S256', state,
      access_type: 'offline', prompt: 'consent',
    }).forEach(([k, v]) => url.searchParams.set(k, v));
    await invoke('native_open_url', { url: url.toString() });
    const query = await invoke('native_oauth_wait', { timeoutSecs: 300 });
    if (!query) throw new Error('Google sign-in was cancelled or timed out');
    const params = new URLSearchParams(query);
    if (params.get('error')) throw new Error(params.get('error'));
    if (params.get('state') !== state) throw new Error('Google sign-in answer did not match the request');
    const body = await postToken({
      grant_type: 'authorization_code', code: params.get('code'), code_verifier: verifier,
      client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri,
    });
    if (body.refresh_token) localStorage.setItem(REFRESH_TOKEN_KEY, body.refresh_token);
    cacheToken(scope, body.access_token, body.expires_in);
    return body.access_token;
  }

  // Resolve an access token for the given scope.
  // interactive=false only returns a still-valid cached token (never opens a popup).
  async function getAccessToken(scope, { interactive = true } = {}) {
    const cached = readCachedToken(scope);
    if (cached) return cached;
    if (isNative()) {
      const refreshed = await nativeRefresh(scope);
      if (refreshed || !interactive) return refreshed;
      return nativeSignIn(scope);
    }
    if (!interactive) return null;
    const clientId = getClientId();
    if (!clientId) {
      throw new Error('Missing Google Client ID — save it in the Calendar settings first.');
    }
    await loadGis();
    return new Promise((resolve, reject) => {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope,
        callback: (resp) => {
          if (resp.error) {
            reject(new Error(resp.error));
            return;
          }
          cacheToken(scope, resp.access_token, resp.expires_in);
          resolve(resp.access_token);
        },
        error_callback: (err) => reject(new Error(err?.type || 'Google sign-in popup failed')),
      });
      // prompt:'' lets Google decide: silent for returning users, consent screen the first time
      tokenClient.requestAccessToken({ prompt: '' });
    });
  }

  function hasSession(scope) {
    if (isNative() && localStorage.getItem(REFRESH_TOKEN_KEY)) return true; // refreshed silently when needed
    return Boolean(readCachedToken(scope));
  }

  function clearTokens() {
    try {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      Object.keys(sessionStorage)
        .filter(k => k.startsWith(TOKEN_CACHE_PREFIX))
        .forEach(k => sessionStorage.removeItem(k));
    } catch { /* ignore */ }
  }

  async function revoke(scope) {
    const token = readCachedToken(scope);
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    clearTokens();
    if (isNative()) {
      try {
        const t = refreshToken || token;
        if (t) await fetch('https://oauth2.googleapis.com/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: t }),
        });
      } catch { /* revocation is best-effort */ }
      return;
    }
    if (token) {
      try {
        await loadGis();
        google.accounts.oauth2.revoke(token, () => {});
      } catch { /* revocation is best-effort */ }
    }
  }

  if (isNative()) loadMcpClient();
  // Desktop app: the saved keys are restored from disk a moment after load; pick up the shared client then.
  window.addEventListener('nativeSecretsRestored', () => { loadMcpClient(); });

  window.GoogleAuth = { getClientId, setClientId, getClientSecret, setClientSecret, getAccessToken, hasSession, clearTokens, revoke, loadGis };
})();
