// drive-sync.js — cross-device data sync via a private Google Drive app folder.
// Backs up the full local data snapshot (same content as Export Data) to the
// Drive appDataFolder — a hidden per-app space only this app can read — and
// restores it on another device through the existing import/merge flow.
// Also runs opportunistic automatic sync:
//   - on startup: pull newer remote backup and merge (silent, never pops up auth)
//   - when the tab is hidden or after 24h: push local snapshot back to Drive
// Reuses the Google Client ID saved in the Calendar settings (GoogleAuth).
(function () {
  const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
  const BACKUP_FILENAME = 'adhd-tools-hub-backup.json';
  const LAST_BACKUP_KEY = 'driveLastBackupAt';
  const AUTO_SYNC_KEY = 'driveAutoSyncEnabled';
  const DRIVE_API = 'https://www.googleapis.com/drive/v3';
  const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
  const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
  const AUTO_PUSH_DEBOUNCE_MS = 3500;
  const AUTO_PULL_INTERVAL_MS = 15 * 1000;
  const REMOTE_GRACE_MS = 2 * 1000;

  let inFlight = false;
  let localChanges = false; // data changed since the last backup (so other devices & the assistant see fresh data)
  let pushDebounceTimer = null;
  let pullIntervalId = null;
  let cachedBackupFileId = null;

  function notify(message, type) {
    if (window.DataManager?.showNotification) {
      window.DataManager.showNotification(message, type);
    } else {
      alert(message);
    }
  }

  async function getToken({ interactive = true } = {}) {
    if (!window.GoogleAuth) throw new Error('Google auth helper not loaded');
    if (!window.GoogleAuth.getClientId()) {
      throw new Error('No Google Client ID saved. Add one in Settings → Calendar Notifications & Google Sync first.');
    }
    return window.GoogleAuth.getAccessToken(SCOPE, { interactive });
  }

  async function findBackupFile(token) {
    const url = new URL(`${DRIVE_API}/files`);
    url.searchParams.set('spaces', 'appDataFolder');
    url.searchParams.set('q', `name = '${BACKUP_FILENAME}'`);
    url.searchParams.set('fields', 'files(id, name, modifiedTime)');
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) throw new Error(`Drive API ${resp.status}`);
    const data = await resp.json();
    const found = (data.files && data.files[0]) || null;
    if (found?.id) cachedBackupFileId = found.id;
    return found;
  }

  // Read a JSON file from the app folder (e.g. the assistant inbox). null if missing or signed out.
  async function readAppFile(name, { interactive = false } = {}) {
    if (!window.GoogleAuth?.getClientId()) return null;
    const token = await getToken({ interactive });
    if (!token) return null;
    const url = new URL(`${DRIVE_API}/files`);
    url.searchParams.set('spaces', 'appDataFolder');
    url.searchParams.set('q', `name = '${name}'`);
    url.searchParams.set('fields', 'files(id)');
    const list = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!list.ok) throw new Error(`Drive API ${list.status}`);
    const file = (await list.json()).files?.[0];
    if (!file) return null;
    const resp = await fetch(`${DRIVE_API}/files/${file.id}?alt=media`, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) throw new Error(`Drive API ${resp.status}`);
    return resp.json();
  }

  function lastLocalPush() {
    const last = Number(localStorage.getItem(LAST_BACKUP_KEY) || 0);
    return Number.isFinite(last) ? last : 0;
  }

  function autoSyncEnabled() {
    return localStorage.getItem(AUTO_SYNC_KEY) !== 'false';
  }

  async function backupToDrive({ silent = false, skipInbox = false } = {}) {
    const status = document.getElementById('drive-sync-status');
    try {
      if (status) status.textContent = 'Backing up…';
      const token = await getToken();
      // Changes queued by the AI assistant (MCP server) go in before the snapshot.
      if (!skipInbox) await window.AssistantInbox?.check({ interactive: true });
      const payload = JSON.stringify(window.DataManager.collectAllData());
      const existing = await findBackupFile(token);

      let resp;
      if (existing) {
        resp = await fetch(`${DRIVE_UPLOAD}/files/${existing.id}?uploadType=media`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: payload,
        });
      } else {
        const boundary = 'adhdtools' + Date.now();
        const body =
          `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
          JSON.stringify({ name: BACKUP_FILENAME, parents: ['appDataFolder'] }) +
          `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
          payload +
          `\r\n--${boundary}--`;
        resp = await fetch(`${DRIVE_UPLOAD}/files?uploadType=multipart`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body,
        });
      }
      if (!resp.ok) throw new Error(`Drive API ${resp.status}`);
      const savedMeta = await resp.json().catch(() => null);
      if (savedMeta?.id) cachedBackupFileId = savedMeta.id;
      const remoteModTs = savedMeta?.modifiedTime ? Date.parse(savedMeta.modifiedTime) : Date.now();

      localStorage.setItem(LAST_BACKUP_KEY, String(Number.isFinite(remoteModTs) ? remoteModTs : Date.now()));
      localChanges = false;
      refreshStatus();
      if (!silent) {
        notify('Backup saved to your Google Drive (private app folder).', 'success');
      }
    } catch (err) {
      console.error('Drive backup failed:', err);
      if (status) status.textContent = 'Backup failed: ' + err.message;
      if (!silent) notify('Backup failed: ' + err.message, 'error');
    }
  }

  async function restoreFromDrive() {
    const status = document.getElementById('drive-sync-status');
    try {
      if (status) status.textContent = 'Looking for a backup…';
      const token = await getToken();
      const existing = await findBackupFile(token);
      if (!existing) {
        if (status) status.textContent = 'No backup found in Google Drive yet.';
        notify('No backup found. Run "Back up now" on the device that has your data.', 'error');
        return;
      }
      const resp = await fetch(`${DRIVE_API}/files/${existing.id}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`Drive API ${resp.status}`);
      const imported = await resp.json();
      if (status) status.textContent = `Restoring backup from ${new Date(existing.modifiedTime).toLocaleString()}…`;
      // Runs the same collision-resolution UI as file import, then reloads.
      window.DataManager.importDataFromObject(imported);
    } catch (err) {
      console.error('Drive restore failed:', err);
      if (status) status.textContent = 'Restore failed: ' + err.message;
      notify('Restore failed: ' + err.message, 'error');
    }
  }

  function applyCloudUpdatesInPlace(updates) {
    const write = window.getStorageLog?.withCloudSyncWrite || (fn => fn());
    write(() => {
      Object.keys(updates).forEach(key => {
        const val = updates[key];
        localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
      });
    });
    window.dispatchEvent(new CustomEvent('cloudSyncApplied', { detail: { keys: Object.keys(updates) } }));
    window.EventBus?.dispatchEvent(new CustomEvent('dataChanged', { detail: { source: 'cloud-sync' } }));
    if ('adhd-calendar-events' in updates) {
      window.EventBus?.dispatchEvent(new Event('calendarEventsUpdated'));
    }
    if ('adhd-tool-routines' in updates || 'adhd-routine-runs' in updates) {
      window.dispatchEvent(new Event('routinesChanged'));
      window.dispatchEvent(new Event('routinePlayerChanged'));
    }
    if ('adhd-tools-config' in updates) {
      window.dispatchEvent(new CustomEvent('configUpdated', { detail: window.ConfigManager?.getConfig?.() }));
    }
    window.dispatchEvent(new Event('scheduleNeedsRefresh'));
    window.DayPlanner?.rerender?.();
  }

  // Automatic pull: merge a newer remote backup into local data in-place.
  // Identical items are skipped, newer versions win automatically.
  async function maybeAutoPull() {
    if (inFlight) return;
    if (!window.GoogleAuth?.getClientId()) return;
    if (!autoSyncEnabled()) return;
    inFlight = true;
    try {
      const token = await getToken({ interactive: false });
      if (!token) return; // not signed in yet — never force a popup
      const remote = await findBackupFile(token);
      if (!remote) return;
      const remoteTs = Date.parse(remote.modifiedTime);
      if (!Number.isFinite(remoteTs)) return;
      if (remoteTs <= lastLocalPush() + REMOTE_GRACE_MS) return; // we pushed last, nothing to pull

      const resp = await fetch(`${DRIVE_API}/files/${remote.id}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) return;
      const imported = await resp.json();

      // Ignore our own device's snapshot if timestamps drifted slightly
      if (imported?.metadata?.deviceId && imported.metadata.deviceId === window.DataManager?.getDeviceId?.() && !localChanges) {
        localStorage.setItem(LAST_BACKUP_KEY, String(remoteTs));
        return;
      }

      const { updates, added, updated } = await window.DataManager.mergeFromBackup(imported);

      if (added === 0 && updated === 0 && Object.keys(updates).length === 0) {
        localStorage.setItem(LAST_BACKUP_KEY, String(remoteTs));
        return;
      }

      applyCloudUpdatesInPlace(updates);
      localStorage.setItem(LAST_BACKUP_KEY, String(remoteTs));
      refreshStatus();
    } catch (err) {
      console.warn('Auto pull skipped:', err.message);
    } finally {
      inFlight = false;
    }
  }

  // Automatic push: backup to Drive shortly after local changes or if older than 24h.
  async function maybeAutoBackup() {
    if (inFlight) return;
    if (!window.GoogleAuth?.getClientId()) return;
    if (!autoSyncEnabled()) return;
    if (!localChanges && Date.now() - lastLocalPush() < AUTO_BACKUP_INTERVAL_MS) return;
    // Pull any newer remote state first so we merge before pushing our changes
    await maybeAutoPull();
    if (inFlight) return;
    inFlight = true;
    try {
      const token = await getToken({ interactive: false });
      if (!token) return;
      await backupToDrive({ silent: true });
    } catch (err) {
      console.warn('Auto backup skipped:', err.message);
    } finally {
      inFlight = false;
    }
  }

  function notifyLocalChange() {
    localChanges = true;
    if (!autoSyncEnabled() || !window.GoogleAuth?.getClientId()) return;
    if (pushDebounceTimer) clearTimeout(pushDebounceTimer);
    pushDebounceTimer = setTimeout(() => {
      pushDebounceTimer = null;
      maybeAutoBackup();
    }, AUTO_PUSH_DEBOUNCE_MS);
  }

  function startSyncLoop() {
    if (pullIntervalId) clearInterval(pullIntervalId);
    pullIntervalId = setInterval(() => {
      if (document.visibilityState === 'visible' && autoSyncEnabled()) {
        if (localChanges) maybeAutoBackup();
        else maybeAutoPull();
      }
    }, AUTO_PULL_INTERVAL_MS);
  }

  function refreshStatus() {
    const status = document.getElementById('drive-sync-status');
    if (!status) return;
    const last = Number(localStorage.getItem(LAST_BACKUP_KEY) || 0);
    const lastDate = last ? new Date(last).toLocaleString() : null;
    if (!window.GoogleAuth?.getClientId()) {
      status.textContent = 'Needs a Google Client ID (Settings → Calendar Notifications & Google Sync).';
    } else if (lastDate) {
      status.textContent = `Last backup from this device: ${lastDate}${autoSyncEnabled() ? ' (automatic sync on)' : ''}`;
    } else {
      status.textContent = 'No backup made from this device yet.';
    }
  }

  function createUI() {
    const host = document.querySelector('.data-management-container');
    if (!host) return;
    const block = document.createElement('div');
    block.className = 'drive-sync-container';
    block.innerHTML = `
      <h3 style="margin-top:1.5rem;">Sync Across Devices (Google Drive)</h3>
      <p class="data-management-note">
        Saves the same snapshot as "Export Data" into a private Google Drive app folder,
        so you can restore it on your phone or another computer.
        <a href="https://github.com/jobellet/ADHDtools/blob/main/docs/sync-across-devices.md" target="_blank" rel="noopener">Tutorial</a>
      </p>
      <label style="display:block; margin:0.5rem 0; font-size:0.9rem;">
        <input type="checkbox" id="drive-auto-sync-toggle" ${autoSyncEnabled() ? 'checked' : ''} />
        Automatic sync (pull on startup, back up daily — never opens a Google popup on its own)
      </label>
      <button id="drive-backup-btn" class="btn btn-primary">
        <i class="fas fa-cloud-upload-alt"></i> Back up now
      </button>
      <button id="drive-restore-btn" class="btn btn-secondary">
        <i class="fas fa-cloud-download-alt"></i> Restore from Drive
      </button>
      <span id="drive-sync-status" class="status" style="display:block; margin-top:0.5rem; font-size:0.85rem;"></span>
    `;
    host.appendChild(block);
    document.getElementById('drive-backup-btn').addEventListener('click', () => backupToDrive());
    document.getElementById('drive-restore-btn').addEventListener('click', restoreFromDrive);
    document.getElementById('drive-auto-sync-toggle').addEventListener('change', (e) => {
      localStorage.setItem(AUTO_SYNC_KEY, e.target.checked ? 'true' : 'false');
      refreshStatus();
      if (e.target.checked) maybeAutoPull().then(maybeAutoBackup);
    });
    refreshStatus();

    if (autoSyncEnabled()) {
      maybeAutoPull().then(maybeAutoBackup);
      startSyncLoop();
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') maybeAutoBackup();
        else if (document.visibilityState === 'visible') maybeAutoPull().then(maybeAutoBackup);
      });
      window.addEventListener('focus', () => {
        if (autoSyncEnabled()) maybeAutoPull().then(maybeAutoBackup);
      });
      window.addEventListener('online', () => {
        if (autoSyncEnabled()) maybeAutoPull().then(maybeAutoBackup);
      });
    }
    window.addEventListener('nativeSecretsRestored', () => {
      refreshStatus();
      if (autoSyncEnabled()) {
        startSyncLoop();
        maybeAutoPull().then(maybeAutoBackup);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', createUI);
  document.addEventListener('DOMContentLoaded', () => {
    window.EventBus?.addEventListener('dataChanged', (e) => {
      if (e?.detail?.source === 'cloud-sync') return;
      notifyLocalChange();
    });
    window.addEventListener('routinesChanged', () => notifyLocalChange());
  });

  window.DriveSync = {
    backupToDrive,
    restoreFromDrive,
    maybeAutoPull,
    maybeAutoBackup,
    notifyLocalChange,
    readAppFile,
    isAutoSyncOn: autoSyncEnabled,
  };
})();
