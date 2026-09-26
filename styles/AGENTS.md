# styles/ — shared CSS (read [../AGENTS.md](../AGENTS.md) first)

Cascade order (index.html): `base.css` → `routine-player.css` → `routine-settings.css` → `routine-mobile.css`
→ `mobile.css` → `assistant.css` → **`app-shell.css`** → `features/*/<name>.css`. Later wins.

| File | Role | Add new rules? |
| --- | --- | --- |
| `base.css` | Legacy styles of all tools (big, older). Also a global phone rule: `.tool-section button { width: 100% }` under 480 px. | **No** — override in the feature CSS instead |
| `mobile.css` | Legacy phone layout: `body` is a 100dvh flex column, sections scroll inside. | No |
| `routine-player.css`, `routine-settings.css`, `routine-mobile.css` | Routine player overlay and older routine sheets. | Only for the player |
| `assistant.css` | Add-sheet form, progress card, AI settings panel. | Small fixes only |
| `app-shell.css` | Design tokens (`:root`), navigation (top bar / phone tab bar), sheets, `[data-cap]` hiding, shared buttons (`.btn-link`, `.btn-block`), `body.modal-open`. | Yes, for shell things |

## Rules
- New feature CSS goes to `features/<name>/<name>.css`, scoped by the section id or feature classes.
- Use the tokens: `--primary-color`, `--surface`, `--on-surface`, `--text-muted`, `--border-color`,
  `--kind-task|routine|event|break|free`. Don't hardcode new colours for those meanings.
- Phones = `max-width: 768px` (bottom tab bar). Touch targets ≥ 44 px; inputs `font-size: 16px` (no iOS zoom).
- Known legacy traps: the 480 px "full-width buttons" rule and `button { transition: all }` (set
  `transition: none` on toggles that must switch instantly).
