# features/settings — Settings screen

Read first: [../AGENTS.md](../AGENTS.md) and [../../shell/AGENTS.md](../../shell/AGENTS.md) (config keys).

| File | Role |
| --- | --- |
| `settings.js` | Maps `#settings-form` fields ↔ `ConfigManager` (General, Calendar, Tasks, Focus…); tasks overview table. "Show all options" applies at once. |
| `ai-settings.js` | Builds the AI provider panel in `#api-settings` (provider, key, model, test) over `AIAssistant`. |
| `settings.css` | One-column layout of the collapsible sections. |
| `strings.js` | Keys `settings.*`. |

- Other panels are filled by services: Google Calendar (`services/google-calendar-sync.js`, `features/calendar/calendar-settings.js`),
  credentials (`services/credentials-sync.js`).
- Panels for integrations the user doesn't use carry `data-cap-hide="gcal"` / `data-cap`.
- Numbers where 0 is valid (buffers) must not use `value || default` (see `numberOr`).
