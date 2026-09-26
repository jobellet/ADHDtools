# services/ — storage and integrations (read [../AGENTS.md](../AGENTS.md) first)

Classic scripts, no screen of their own (they add small UI blocks into Settings or About).

| File | Role | Adds UI to |
| --- | --- | --- |
| `timestamp-storage.js` | Wraps `localStorage.setItem` to log when each key changed (`adhd-storage-log`, used to merge backups). Must load first. | — |
| `data-manager.js` | `window.EventBus` (created here), `window.DataManager` (legacy task API over `TaskStore`), export/import JSON, email export, conflict dialog, `showNotification()`. Excludes secrets via `isSensitiveKey()`. | About → Data Management |
| `google-auth.js` | `window.GoogleAuth`: OAuth token client (Client ID only, no API key); tokens in `sessionStorage`. | — |
| `google-calendar-sync.js` | Private Google Calendar sync → `CalendarTool.ingestExternalEvents()`; export buttons on planner hours (only when connected). Fires `capabilitiesChanged` on connect/disconnect. | Settings → Calendar Notifications & Google Sync |
| `drive-sync.js` | `window.DriveSync`: backup/restore/auto-sync with Google Drive app folder, using `DataManager.mergeFromBackup` (→ `core/sync-merge.js`). | About → Sync Across Devices |
| `credentials-sync.js` | `window.CredentialsSync`: encrypted export/import of API keys and Client ID. | Settings → Credentials Sync |
| `cross-tool-interaction.js` | `window.CrossTool.sendTaskToTool(task, tool)` → fires `ef-receiveTaskFor-<Tool>` on `EventBus`. | — |

## Rules
- **Sync must not resurrect deleted tasks:** merges filter `adhd-unified-tasks` with the tombstones in
  `adhd-deleted-tasks` from both sides (`core/sync-merge.js` and `detectCollisions` in `data-manager.js`).
- **Secrets never leave the device** unencrypted: keep new secret keys matched by `isSensitiveKey()`.
- Google calls go directly browser → Google. No other hosts. Scopes: see `google-calendar-sync.js`, `drive-sync.js`.
- `import()` paths in classic scripts resolve from the script's own URL (`../core/…` from here).
- User setup guides: [docs/google-calendar-sync.md](../docs/google-calendar-sync.md), [docs/sync-across-devices.md](../docs/sync-across-devices.md).
