// drive-sync.js — cross-device data sync via a private Google Drive app folder.
// Backs up the full local data snapshot (same content as Export Data) to the
// Drive appDataFolder — a hidden per-app space only this app can read — and
// restores it on another device through the existing import/merge flow.
// Reuses the Google Client ID saved in the Calendar settings (GoogleAuth).
(function () {
  const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
  const BACKUP_FILENAME = 'adhd-tools-hub-backup.json';
  const LAST_BACKUP_KEY = 'driveLastBackupAt';
  const DRIVE_API = 'https://www.googleapis.com/drive/v3';
  const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

  function notify(message, type) {
    if (window.DataManager?.showNotification) {
      window.DataManager.showNotification(message, type);
    } else {
      alert(message);
    }
  }

  async function getToken() {
    if (!window.GoogleAuth) throw new Error('Google auth helper not loaded');
    if (!window.GoogleAuth.getClientId()) {
      throw new Error('No Google Client ID saved. Add one in Settings → Calendar Notifications & Google Sync first.');
    }
    return window.GoogleAuth.getAccessToken(SCOPE, { interactive: true });
  }

  async function findBackupFile(token) {
    const url = new URL(`${DRIVE_API}/files`);
    url.searchParams.set('spaces', 'appDataFolder');
    url.searchParams.set('q', `name = '${BACKUP_FILENAME}'`);
    url.searchParams.set('fields', 'files(id, name, modifiedTime)');
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) throw new Error(`Drive API ${resp.status}`);
    const data = await resp.json();
    return (data.files && data.files[0]) || null;
  }

  async function backupToDrive() {
    const status = document.getElementById('drive-sync-status');
    try {
      if (status) status.textContent = 'Backing up…';
      const token = await getToken();
      const payload = JSON.stringify(window.DataManager.collectAllData());
      const existing = await findBackupFile(token);

      let resp;
      if (existing) {
        // Update file content in place
        resp = await fetch(`${DRIVE_UPLOAD}/files/${existing.id}?uploadType=media`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: payload,
        });
      } else {
        // Create with multipart upload (metadata + content)
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

      localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
      refreshStatus();
      notify('Backup saved to your Google Drive (private app folder).', 'success');
    } catch (err) {
      console.error('Drive backup failed:', err);
      if (status) status.textContent = 'Backup failed: ' + err.message;
      notify('Backup failed: ' + err.message, 'error');
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

  function refreshStatus() {
    const status = document.getElementById('drive-sync-status');
    if (!status) return;
    const last = localStorage.getItem(LAST_BACKUP_KEY);
    if (!window.GoogleAuth?.getClientId()) {
      status.textContent = 'Needs a Google Client ID (Settings → Calendar Notifications & Google Sync).';
    } else if (last) {
      status.textContent = `Last backup from this device: ${new Date(last).toLocaleString()}`;
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
      <button id="drive-backup-btn" class="btn btn-primary">
        <i class="fas fa-cloud-upload-alt"></i> Back up now
      </button>
      <button id="drive-restore-btn" class="btn btn-secondary">
        <i class="fas fa-cloud-download-alt"></i> Restore from Drive
      </button>
      <span id="drive-sync-status" class="status" style="display:block; margin-top:0.5rem; font-size:0.85rem;"></span>
    `;
    host.appendChild(block);
    document.getElementById('drive-backup-btn').addEventListener('click', backupToDrive);
    document.getElementById('drive-restore-btn').addEventListener('click', restoreFromDrive);
    refreshStatus();
  }

  document.addEventListener('DOMContentLoaded', createUI);

  window.DriveSync = { backupToDrive, restoreFromDrive };
})();
