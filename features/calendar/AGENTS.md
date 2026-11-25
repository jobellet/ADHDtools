# features/calendar — Calendar screen and calendar data

Read first: [../AGENTS.md](../AGENTS.md). Legacy UI (partly English).

| File | Role |
| --- | --- |
| `calendar-tool.js` | Owns `adhd-calendar-events`: day/week/month views (`#calendar-view`), `.ics` file/URL import (fields in Settings), voice announcements, `CalendarTool.ingestExternalEvents()` used by Google sync. Fires `calendarEventsUpdated`. |
| `calendar-settings.js` | Google Client ID box in Settings (`#gcal-settings-container`). |
| `strings.js` | Calendar strings (en/fr/de/es), keys `calendar.*`. |
| `calendar.css` | Style of the one-time voice alerts bubble and card (`#voice-welcome-notice`). |

- Events: `{ id, uid, title, start 'YYYY-MM-DDTHH:MM', end, isFixed, isCalendarEvent }`. `[FIX]`/`[FLEX]` in titles set `isFixed`. `notATask: true` (set from the Now view or Day Planner context menu) keeps the event in the calendar but frees its time for tasks. `CalendarTool.findEventByHash/postponeEvent/markEventPassive/updateEvent/deleteEvent` are the Now view and Day Planner event actions. Deleted calendar events write tombstones to `adhd-deleted-tasks` so Google Calendar and ICS re-syncs never resurrect them.
- The scheduler reads fixed events for the day (`core/scheduler.js` → `loadCalendarBlocks`) when
  `includeCalendarInSchedule` is on; they block time.
- Saving an ICS URL fires `capabilitiesChanged`. Once Google is connected, ICS controls are hidden (`data-cap-hide="gcal"`).
- Voice alerts (`adhd-calendar-voice-enabled`, `adhd-calendar-voice-early`) are **on by default**, 5 minutes early; only a stored `'false'` turns them off. While the user has never saved a voice setting, `#voice-welcome-notice` says so: a small 🔊 bubble in the bottom-right corner (above the phone tab bar, `pointer-events` only on itself, never blocks the app). Tapping it (`#voice-notice-toggle`) opens a small card (`#voice-notice-panel`) with *Turn off* / *OK*; tap again or Escape makes it small. Both buttons save the settings, so it shows once.
