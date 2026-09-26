# features/calendar — Calendar screen and calendar data

Read first: [../AGENTS.md](../AGENTS.md). Legacy UI (partly English).

| File | Role |
| --- | --- |
| `calendar-tool.js` | Owns `adhd-calendar-events`: day/week/month views (`#calendar-view`), `.ics` file/URL import (fields in Settings), voice announcements, `CalendarTool.ingestExternalEvents()` used by Google sync. Fires `calendarEventsUpdated`. |
| `calendar-settings.js` | Google Client ID box in Settings (`#gcal-settings-container`). |

- Events: `{ id, uid, title, start 'YYYY-MM-DDTHH:MM', end, isFixed, isCalendarEvent }`. `[FIX]`/`[FLEX]` in titles set `isFixed`. `notATask: true` (set from the Now view) keeps the event in the calendar but frees its time for tasks. `CalendarTool.findEventByHash/postponeEvent/markEventPassive` are the Now view’s event actions.
- The scheduler reads fixed events for the day (`core/scheduler.js` → `loadCalendarBlocks`) when
  `includeCalendarInSchedule` is on; they block time.
- Saving an ICS URL fires `capabilitiesChanged`. Once Google is connected, ICS controls are hidden (`data-cap-hide="gcal"`).
