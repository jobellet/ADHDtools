# features/thoughts — quick raw notes accumulation, speech input, Google Drive text sync and AI summaries

Read first: [../AGENTS.md](../AGENTS.md). Core flow.

| File | Role |
| --- | --- |
| `thoughts.js` | Quick thoughts storage in `adhd-thoughts`, daily accumulation, speech recognition (Web Speech / Native speech / AI STT), text file sync to Google Drive via DriveSync, AI daily summary and restructuring into tasks via AIAssistant. |
| `thoughts.css` | Styling for the quick thoughts screen and cards, responsive at 390px and desktop. |
| `strings.js` | Translations for thoughts in en, fr, de, es. |

- Markup lives in `index.html` inside `<section id="thoughts" class="tool-section">`.
- Global: `window.QuickThoughts`.
- Storage: `adhd-thoughts` (JSON map of date strings `YYYY-MM-DD` to arrays of thought objects).
- Drive file: `ADHD-Thoughts-YYYY-MM-DD.txt` synchronized via `DriveSync.saveTextFile`.
