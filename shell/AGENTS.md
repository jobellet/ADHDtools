# shell/ — router, config, translations, setup detection (read [../AGENTS.md](../AGENTS.md) first)

| File | Role |
| --- | --- |
| `app.js` | Navigation and routing. Tabs (Now / Plan / Add / Routines / More), the More and Add **sheets**, URL slugs (`/Day_Planner`, `/routine`…, base path `/ADHDtools` on GitHub Pages), the header clock. Globals: `switchTool`, `AppRouter`, `AppSheets`. |
| `config.js` | `ConfigManager` over `adhd-tools-config`. Defaults live in `DEFAULT_CONFIG` (dayStart/End, `routineBufferPercent`, `bufferDurationMinutes`, `breakWindowMinutes`, `contextAutoSwitch`, `showAllOptions`, …). `updateConfig()` fires `configUpdated`. |
| `i18n.js` | Static-page strings (`data-i18n` keys in `index.html`) for en/fr/de/es, and the `I18n` API: `t(key, vars, fallback)`, `getLang()`, `register(dict)`. Applies translations on `DOMContentLoaded` and on flag clicks, then fires `languageChanged`. Also handles `data-i18n-placeholder` and `data-i18n-title`. |
| `capabilities.js` | Detects the setup (`gcal`, `ics`, `ai`, `speech`, `showAll`) and sets `body.cap-*` / `body.show-all-options`. CSS in `styles/app-shell.css` hides `[data-cap]` / `[data-cap-hide]` elements. Re-runs on `configUpdated`, `aiSettingsChanged`, `capabilitiesChanged`, `storage`. |

## Auto-routing (app.js)
Opening the root URL turns **auto mode** on: the Now view while `NowState` says `doing`/`break`, the
day planner when `free`. `features/now/now-view.js` calls `AppRouter.autoRoute(state)` when the mode
changes. Any explicit navigation (`switchTool`, a tab, back/forward) turns auto mode off.

## Adding things
- **New screen:** add the `<section class="tool-section" id="x">` in `index.html`, an entry in `TOOLS`
  in `app.js` (slug, icon, title) and a link in the More menu (`#main-nav-links`).
- **New setting:** default in `config.js` → field in `index.html` (Settings, `setting-…` id) → read/write in
  `features/settings/settings.js` → label key in `features/settings/strings.js`.
- **New capability:** detect it in `capabilities.js`, add the CSS rule next to the others in `styles/app-shell.css`.
- **Strings:** static page text only here; feature strings go in `features/<name>/strings.js` via `I18n.register`.
