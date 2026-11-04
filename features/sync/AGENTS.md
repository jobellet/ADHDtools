# features/sync — sync button (no screen)

Read first: [../AGENTS.md](../AGENTS.md) and [../../services/AGENTS.md](../../services/AGENTS.md) (Google sync).

| File | Role |
| --- | --- |
| `sync-button.js` | `#sync-status-btn` in the top bar (`index.html`, next to Thoughts). Hidden until Google is set up (Client ID + Calendar connected, or a Drive backup made on this device). `data-state`: `off` (red: no Google session — on the website the sign-in lasts ~1 h), `on` (green), `busy`, `error` (red, message in the label). A tap signs in (the tap is the gesture the Google popup needs), runs `GoogleCalendarSync.syncNow()` when Calendar is connected, then `DriveSync.syncNow()`. Re-checks the colour every 30 s and on focus/visibility. |
| `sync.css` | The round button and its coloured dot. On phones it sits in the bottom bar's second row. |
| `strings.js` | Keys `sync.*` (the button's label/title). |

- Drive-only users are asked only for the Drive scope, never for Calendar.
- No request at load: the button only reads `localStorage` / the cached token until it is tapped.
