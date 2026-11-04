# features/calendar — Calendar screen and calendar data

Read first: [../AGENTS.md](../AGENTS.md). Legacy UI (partly English).

| File | Role |
| --- | --- |
| `calendar-tool.js` | Owns `adhd-calendar-events`: day/week/month views (`#calendar-view`), `.ics` file/URL import (fields in Settings), voice announcements, `CalendarTool.ingestExternalEvents()` used by Google sync. Fires `calendarEventsUpdated`. |
| `calendar-settings.js` | Google Client ID box in Settings (`#gcal-settings-container`). |

- Events: `{ id, uid, title, start 'YYYY-MM-DDTHH:MM', end, isFixed, isCalendarEvent }`. `[FIX]`/`[FLEX]` in titles set `isFixed`. `notATask: true` (set from the Now view) keeps the event in the calendar but frees its time for tasks. `CalendarTool.findEventByHash/postponeEvent/markEventPassive` are the Now view’s event actions.
- **Deleted at the source → deleted here.** Google sync passes `ingestExternalEvents(events, { source: 'gcal', from, to })`
  with every selected calendar at once: events of that source (`source: 'gcal'`, or older ones with a
  `…@google.com` uid) that start in the range and are missing from the list are removed with their TaskStore
  copies (`TaskStore.deleteTasks`). Their `calendarInstanceId` goes to `adhd-calendar-removed`
  (`{ id, deletedAt }`, kept 90 days) so `core/sync-merge.js` drops them from another device's Drive backup
  (unless Google changed the event again later: its `updatedAt` is Google's `updated`).
- The scheduler reads fixed events for the day (`core/scheduler.js` → `loadCalendarBlocks`) when
  `includeCalendarInSchedule` is on; they block time.
- Saving an ICS URL fires `capabilitiesChanged`. Once Google is connected, ICS controls are hidden (`data-cap-hide="gcal"`).
