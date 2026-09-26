# features/ — one folder per screen (read [../AGENTS.md](../AGENTS.md) first)

## Anatomy of a feature
```
features/<name>/
  AGENTS.md      what it does, files, DOM ids, events, gotchas (read this before editing)
  <name>.js      classic script (or ES module for planner), starts on DOMContentLoaded
  <name>.css     styles for this feature only (optional; loaded after styles/app-shell.css)
  strings.js     I18n.register({ en, fr, de, es }) — keys prefixed by the feature (optional)
```
The markup lives in `index.html`, in `<section class="tool-section" id="<section id>">`.
A feature talks to others only through `window.*` globals and events (see root contracts), never by
reaching into another feature's DOM.

| Feature | Section id | Main files | Status |
| --- | --- | --- | --- |
| [now](now/AGENTS.md) | `home` (+ Add sheet `#capture-sheet`) | `now-view.js`, `quick-capture.js` | core flow |
| [planner](planner/AGENTS.md) | `planner` | `day-planner.js` (ESM), `planner-utils.js`, `render-day.js` | core flow |
| [routine](routine/AGENTS.md) | `routine` (+ player overlay `#routine-focus-mode`) | `routine.js` | core flow |
| [settings](settings/AGENTS.md) | `settings` | `settings.js`, `ai-settings.js` | core |
| [calendar](calendar/AGENTS.md) | `calendar` | `calendar-tool.js`, `calendar-settings.js` | legacy UI |
| [focus](focus/AGENTS.md) | `focus` (+ overlay `#fullscreen-focus-mode`) | `focus-mode.js` | legacy UI |
| [breakdown](breakdown/AGENTS.md) | `breakdown` | `task-breakdown.js` | legacy UI |
| [pomodoro](pomodoro/AGENTS.md) | `pomodoro` | `pomodoro.js` | legacy UI |
| [habits](habits/AGENTS.md) | `habits` | `habit-tracker.js` | legacy UI |
| [rewards](rewards/AGENTS.md) | `rewards` | `reward-system.js` | legacy UI |

"Legacy UI" = works, still partly English, styled by `styles/base.css`. When you touch one, move its
new strings to `strings.js` and new CSS to its own `.css` file.

## Add a new feature (checklist)
1. `features/<name>/` with `AGENTS.md`, JS, optional CSS and `strings.js`.
2. `index.html`: the `<section>`; `<link>` after the other feature CSS; `<script defer>` in group 3
   (and `strings.js` after the other `strings.js`).
3. `shell/app.js`: add it to `TOOLS`; add a link in the More menu (or a tab if it is a main flow).
4. Row in the table above; global/event/storage rows in the root `AGENTS.md` if you add any.
5. `npm test` (architecture test checks files are referenced and documented) + browser check.
