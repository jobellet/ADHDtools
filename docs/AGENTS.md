# docs/ — documentation map (read [../AGENTS.md](../AGENTS.md) first)

| File | Audience | Update when |
| --- | --- | --- |
| `using-the-app.md` | Users | Any visible behaviour changes (screens, buttons, settings) |
| `task-model.md` | Devs | Task fields, TaskStore API, scheduler rules change |
| `vision-roadmap.md` | Everyone | A roadmap item is done or added (Current Status list) |
| `transition-plan.md` | Devs | Context-aware dashboard steps progress |
| `google-calendar-sync.md`, `sync-across-devices.md`, `ai-providers.md` | Users | Integration UI/menu paths change |
| `mcp.md` | Users | MCP tools, setup steps or sync timing change (tests check every tool is listed) |
| `mcp-troubleshooting.md` | Users | A new error message or setup screen: one section per message, titled with the words the user sees, with `<a name="…">`; link it from a **Stuck?** box in `mcp.md` and from the code with `help('…')` (tests check all links) |
| `privacy.md` | Users, Google review | Data the app or the MCP server reads or sends changes (it is the privacy policy link in Google's Branding page) |
| `testing.md` | Devs/QA | Manual test scenarios for new flows |
| `contributing.md` | Contributors | Setup, commands, conventions |
| `flags/*.svg` | README language bar | — |

- **READMEs:** `README.md` (en) and `README.de.md`, `README.fr.md`, `README.es.md` share one structure.
  A change in one needs the same change in the three others (translated), in the same commit.
- Detailed guides are English only. Use simple words and short sentences (many readers are not native speakers).
- Menu paths as users see them: **More → Settings → …**, **Plan**, **Add**, **Routines**.
