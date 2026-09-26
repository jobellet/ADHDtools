# mcp/ — MCP server for AI assistants (read [../AGENTS.md](../AGENTS.md) first)

Node only (no browser, no npm packages). Lets an AI assistant read the user's day and queue changes,
through the user's own Google Drive. User setup guide: [docs/mcp.md](../docs/mcp.md).

| File | Role |
| --- | --- |
| `server.js` | Entry: MCP JSON-RPC over stdio (default), over HTTP (`http`, needs `ADHD_MCP_TOKEN`), and `auth`. `handle()` = the protocol; `INSTRUCTIONS` = what the AI is told. |
| `tools.js` | The tools. `loadState()` reads the Drive backup (+ changes still in the inbox), then runs `core/scheduler.js` on it with an in-memory `localStorage`. Read tools: `get_overview`, `list_tasks`, `get_schedule`, `find_free_slots`, `list_routines`. Write tools come from `OPS` in `core/assistant-ops.js`: `add_task`, `update_task`, `schedule_task`, `complete_task`, `delete_task`, `break_down_task`. |
| `store.js` | Where data lives: Google Drive app folder (refresh token from `auth` or env vars) or a local folder (`ADHD_MCP_DATA_DIR`, tests). |
| `auth.js` | One-time Google sign-in (loopback + PKCE), saves the refresh token in the user's config folder (`credentialsPath()`, mode 600). |
| `coverage.js` | For every TaskStore method, scheduler function, task field, storage key and global: which tool uses it, or why not. Checked by `tests/mcp-coverage.test.js`. |

## Data flow (do not break)
- The **backup** file (`BACKUP_FILENAME` in `store.js`) is written only by the app. The server only reads it.
- The **inbox** file (`INBOX_FILENAME` in `core/assistant-ops.js`) is written only by the server. The app only reads it
  (`features/assistant/assistant-inbox.js`), applies each op once, and lists applied op ids in
  `adhd-assistant-applied` (inside the next backup). The server then drops those ops from the inbox.
  One writer per file = no lost changes.
- An op is planned twice with the same code (`core/assistant-ops.js`): by the server with
  `onConflict: 'refuse'` (the AI gets the reason and the next free time) and by the app with
  `onConflict: 'move'` (the day may have changed; never double-book).
- Secrets: the backup never has API keys or Client IDs (`isSensitiveKey`); the server only reads the
  keys marked `read` in `coverage.js`.

## When you add something to the app
`npm test` fails in `tests/mcp-coverage.test.js` when the app gets a new TaskStore method, scheduler function,
task field, `adhd-…` storage key, `window.*` global or assistant op that `coverage.js` does not list. Then:
1. Decide: should the assistant see or change it? If yes, extend a tool in `tools.js` or add an op to
   `OPS` in `core/assistant-ops.js` (schema + `plan`), and name that tool in `coverage.js`.
   If not, write `'no: <reason>'`.
2. A new tool also needs: a row in the tools table of `docs/mcp.md`, a mention here, a call in
   `tests/mcp.test.js` or `tests/assistant-ops.test.js`, and a sample input in `tests/mcp-coverage.test.js`.
3. Changing how a stored shape looks: the server reads old backups too (users keep their data).

## Checks
`npm test` (protocol over stdio and HTTP, ops, coverage) and `npm run test:ui` (`tests/ui/assistant.test.js`:
server → inbox → the real app applies it → backup → server sees it done).
Try it by hand: `ADHD_MCP_DATA_DIR=/tmp/x node mcp/server.js` and type JSON-RPC lines, or use any MCP inspector.
