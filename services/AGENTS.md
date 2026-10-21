# services/ — storage and integrations (read [../AGENTS.md](../AGENTS.md) first)

Classic scripts, no screen of their own (they add small UI blocks into Settings or About).

| File | Role | Adds UI to |
| --- | --- | --- |
| `timestamp-storage.js` | Wraps `localStorage.setItem` and `localStorage.removeItem` to log when each key changed (`adhd-storage-log`, used to merge backups), debounces native disk sync (`DataManager.syncToNativeDisk()`), and notifies `DriveSync.notifyLocalChange()`. Must load first. | — |
| `data-manager.js` | `window.EventBus` (created here), `window.DataManager` (legacy task API over `TaskStore`), export/import JSON, email export, conflict dialog, `showNotification()`, `syncToNativeDisk()` / `restoreFromNativeDisk()` (Tauri native bridge mirroring). Excludes secrets via `isSensitiveKey()`. | About → Data Management |
| `google-auth.js` | `window.GoogleAuth`: OAuth token client (Client ID only, no API key); shares cached tokens across Calendar + Drive scopes. | — |
| `google-calendar-sync.js` | Private Google Calendar sync → `CalendarTool.ingestExternalEvents()`; requests combined Calendar + Drive scopes so one sign-in enables both; export button on each planned task in the day planner (only when connected). Fires `capabilitiesChanged` on connect/disconnect. | Settings → Calendar Notifications & Google Sync |
| `drive-sync.js` | `window.DriveSync`: continuous cross-device sync via Google Drive `appDataFolder`, using `DataManager.mergeFromBackup` (→ `core/sync-merge.js`). Debounces auto-push (~3.5 s) after local changes, polls for remote changes every 15 s (plus on focus/visibility/online), and applies updates live in-place (`cloudSyncApplied`). `readAppFile(name)` reads another app-folder file (the assistant inbox). | About → Sync Across Devices |
| `credentials-sync.js` | `window.CredentialsSync`: encrypted export/import of API keys and Client ID. | Settings → Credentials Sync |
| `cross-tool-interaction.js` | `window.CrossTool.sendTaskToTool(task, tool)` → fires `ef-receiveTaskFor-<Tool>` on `EventBus`. | — |
| `attention-service.js` | `window.AttentionService`: background attention and native bridge (wake lock, intrusive repeating alarm + foreground activation, desktop notifications, pip, native tray/title, `scheduleAlarms()` hands the coming alarms to the native app so Android rings them with the screen off). | — |

## Rules
- **Sync must not resurrect deleted tasks:** merges filter `adhd-unified-tasks` with the tombstones in
  `adhd-deleted-tasks` from both sides (`core/sync-merge.js` and `detectCollisions` in `data-manager.js`).
- **Secrets never leave the device** unencrypted: keep new secret keys matched by `isSensitiveKey()`.
- Google calls go directly browser → Google. No other hosts. Scopes: see `google-calendar-sync.js`, `drive-sync.js`.
- `import()` paths in classic scripts resolve from the script's own URL (`../core/…` from here).
- User setup guides: [docs/google-calendar-sync.md](../docs/google-calendar-sync.md), [docs/sync-across-devices.md](../docs/sync-across-devices.md).
