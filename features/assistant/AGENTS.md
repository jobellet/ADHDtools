# features/assistant — apply changes made by an AI assistant (no screen)

Read first: [../AGENTS.md](../AGENTS.md) and [../../mcp/AGENTS.md](../../mcp/AGENTS.md) (the server side).

| File | Role |
| --- | --- |
| `assistant-inbox.js` | `window.AssistantInbox`: `check({ interactive })` reads the inbox file from Drive (`DriveSync.readAppFile`), `applyInbox(inbox)` applies each new op once through `TaskStore` (rules from `core/assistant-ops.js`, `onConflict: 'move'`), writes the ledger `adhd-assistant-applied`, fires `dataChanged` + `scheduleNeedsRefresh`, shows a message, then backs up (`DriveSync.backupToDrive`). Runs 1.5 s after start, when the tab becomes visible, and every 2 min while visible. |
| `strings.js` | Keys `assistant.*`. |

- Never opens a Google popup by itself (`interactive: false`); **Back up now** calls `check({ interactive: true })`.
- Does nothing when *Automatic sync* is off or Google is not connected.
- Browser test: `tests/ui/assistant.test.js` (fake Drive in the page).
