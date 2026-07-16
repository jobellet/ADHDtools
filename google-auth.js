// google-auth.js — shared Google Identity Services (GIS) helper.
// OAuth token flow only: needs just an OAuth Client ID (no API key).
// Used by calendar-integration.js (Calendar sync) and drive-sync.js (Drive backup).
(function () {
  const CLIENT_ID_KEY = 'gcalClientId';
  const TOKEN_CACHE_PREFIX = 'google-token:'; // sessionStorage, cleared when the browser closes
  let gisReadyPromise = null;

  function getClientId() {
    try {
      return localStorage.getItem(CLIENT_ID_KEY) || '';
    } catch {
      return '';
    }
  }

  function setClientId(id) {
    localStorage.setItem(CLIENT_ID_KEY, id);
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
      if (!raw) return null;
      const { token, expiresAt } = JSON.parse(raw);
      // 60s safety margin so we never hand out a token about to expire
      if (!token || Date.now() > expiresAt - 60000) return null;
      return token;
    } catch {
      return null;
    }
  }

  function cacheToken(scope, token, expiresInSeconds) {
    try {
      sessionStorage.setItem(TOKEN_CACHE_PREFIX + scope, JSON.stringify({
        token,
        expiresAt: Date.now() + (parseInt(expiresInSeconds, 10) || 3600) * 1000,
      }));
    } catch { /* storage full or blocked — token stays usable for this call */ }
  }

  // Resolve an access token for the given scope.
  // interactive=false only returns a still-valid cached token (never opens a popup).
  async function getAccessToken(scope, { interactive = true } = {}) {
    const cached = readCachedToken(scope);
    if (cached) return cached;
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
    return Boolean(readCachedToken(scope));
  }

  function clearTokens() {
    try {
      Object.keys(sessionStorage)
        .filter(k => k.startsWith(TOKEN_CACHE_PREFIX))
        .forEach(k => sessionStorage.removeItem(k));
    } catch { /* ignore */ }
  }

  async function revoke(scope) {
    const token = readCachedToken(scope);
    clearTokens();
    if (token) {
      try {
        await loadGis();
        google.accounts.oauth2.revoke(token, () => {});
      } catch { /* revocation is best-effort */ }
    }
  }

  window.GoogleAuth = { getClientId, setClientId, getAccessToken, hasSession, clearTokens, revoke, loadGis };
})();
