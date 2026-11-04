// features/sync/sync-button.js — one small button in the top bar for Google sync.
// Shown only once the user set up Google (Calendar connected or a Drive backup made on this device),
// so people who use the app offline never see it. Red: no Google session (on the website the
// sign-in lasts about an hour) — a tap signs in and syncs. Green: signed in, automatic sync runs;
// a tap syncs now. Syncs Google Calendar (when connected), then the Drive backup.
(function () {
  const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
  const RECHECK_MS = 30 * 1000; // the web sign-in expires silently: re-check the colour

  let button = null;
  let busy = false;
  let lastError = null;
  let errorAt = 0;
  let lastSyncAt = 0;

  const t = (key, vars) => window.I18n?.t?.(key, vars) || key;

  function calendarConnected() {
    return Boolean(window.GoogleCalendarSync?.isConnected?.());
  }

  function isSetUp() {
    if (!window.GoogleAuth?.getClientId?.()) return false;
    return calendarConnected() || Boolean(localStorage.getItem('driveLastBackupAt'));
  }

  // Drive-only users are never asked for Calendar access.
  function scope() {
    return calendarConnected() ? window.GoogleCalendarSync.SCOPES : DRIVE_SCOPE;
  }

  // Latest successful sync of any kind (button, Calendar auto-sync, Drive backup).
  function lastSyncMs() {
    const stamps = [lastSyncAt, Date.parse(localStorage.getItem('gcalLastSyncAt') || ''), Number(localStorage.getItem('driveLastBackupAt') || 0)]
      .filter(Number.isFinite);
    return Math.max(0, ...stamps);
  }

  function render() {
    if (!button) return;
    const visible = isSetUp();
    button.hidden = !visible;
    if (!visible) return;
    if (lastError && lastSyncMs() > errorAt) lastError = null; // an automatic sync worked since
    let state;
    let label;
    if (busy) {
      state = 'busy';
      label = t('sync.busy');
    } else if (lastError) {
      state = 'error';
      label = t('sync.failed', { error: lastError });
    } else if (window.GoogleAuth.hasSession(scope())) {
      state = 'on';
      const last = lastSyncMs();
      label = last
        ? t('sync.on', { time: new Date(last).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })
        : t('sync.onNoTime');
    } else {
      state = 'off';
      label = t('sync.off');
    }
    button.dataset.state = state;
    button.setAttribute('aria-label', label);
    button.title = label;
    button.setAttribute('aria-busy', busy ? 'true' : 'false');
  }


  async function syncAll() {
    if (busy) return;
    busy = true;
    lastError = null;
    render();
    try {
      // The click is the user gesture that lets the Google sign-in popup open.
      const token = await window.GoogleAuth.getAccessToken(scope(), { interactive: true });
      if (!token) throw new Error('no Google session');
      if (calendarConnected()) await window.GoogleCalendarSync.syncNow({ interactive: false });
      await window.DriveSync?.syncNow?.({ interactive: false });
      lastSyncAt = Date.now();
    } catch (err) {
      console.warn('Sync failed:', err);
      lastError = err?.message || String(err);
      errorAt = Date.now();
    } finally {
      busy = false;
      render();
    }
  }

  function init() {
    button = document.getElementById('sync-status-btn');
    if (!button) return;
    button.addEventListener('click', syncAll);
    render();
    ['capabilitiesApplied', 'cloudSyncApplied', 'nativeSecretsRestored', 'languageChanged', 'focus']
      .forEach(name => window.addEventListener(name, render));
    window.EventBus?.addEventListener('calendarEventsUpdated', render);
    document.addEventListener('visibilitychange', render);
    setInterval(render, RECHECK_MS);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
