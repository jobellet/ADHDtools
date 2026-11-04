# features/settings — Settings screen

Read first: [../AGENTS.md](../AGENTS.md) and [../../shell/AGENTS.md](../../shell/AGENTS.md) (config keys).

| File | Role |
| --- | --- |
| `settings.js` | Maps `#settings-form` fields ↔ `ConfigManager` (General, Calendar, Tasks, Focus…); tasks overview table. "Show all options" applies at once. |
| `ai-settings.js` | Builds the AI provider panel in `#api-settings` (provider, key, model, test) over `AIAssistant`. |
| `update-check.js` | **App updates** panel (`#settings-updates-panel`, `hidden` until shown), desktop/Android only. Reads the build stamp **build-info.json** (written by `scripts/prepare-desktop.cjs` and `android/app/build.gradle`; absent on the website, never fetched there) and compares its commit with `main` on `api.github.com` (latest commit, then `compare` for the count). Only on **Check for updates** or, if the user turned it on, once a day (first check 60 s after opening). Result inline: up to date / N changes + the commands to update / could not check. State in `adhd-update-check` `{ daily, lastCheck }`. `window.UpdateCheck`. |
| `settings.css` | One-column layout of the collapsible sections; App updates result box. |
| `strings.js` | Keys `settings.*` (`settings.updates.*` for App updates). |

- Other panels are filled by services: Google Calendar (`services/google-calendar-sync.js`, `features/calendar/calendar-settings.js`),
  credentials (`services/credentials-sync.js`).
- Panels for integrations the user doesn't use carry `data-cap-hide="gcal"` / `data-cap`.
- Numbers where 0 is valid (buffers) must not use `value || default` (see `numberOr`).
