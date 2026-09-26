# Using the App

The app is built to give you as little to think about as possible. At any moment you do one of three things:

1. **Do** the one thing on the screen (the **Now** view).
2. **Rest** and see what comes next (the break countdown).
3. **Plan** ahead: place tasks, split big ones into small steps (the **Plan** view).

The app picks the right screen for you when you open it.

## What opens when you start the app

| Situation | What you see |
| --- | --- |
| A task, routine or calendar event is scheduled now | **Now** view: that one thing, a big countdown and 2–3 buttons |
| Nothing now, but something starts soon (15 min by default) | **Now** view in *break* mode: a countdown until the next item |
| Nothing planned now | **Plan** view (the day planner) |

While you stay on these screens, the app follows your schedule and switches between them by itself. As soon as you open another screen yourself, it stops switching until you open the app again.

## Navigation

| Tab | Use it to |
| --- | --- |
| **Now** | Do the current task, routine or event |
| **Plan** | See the whole day, add events at a time, plan ahead |
| **Add** | Type or speak a new task in plain words |
| **Routines** | Create, edit and start routines |
| **More** | Other tools (Task Breakdown, Focus Mode, Pomodoro, Calendar, Habits, Rewards), Settings, user profile and language |

On a phone the tabs are at the bottom of the screen; on a computer they are at the top.

## The Now view

**For a task**

- **Done** — marks the task complete (you earn points) and moves on to the next one.
- **Focus** — opens the full-screen focus timer for the time that is left.
- **Not now** — gives three choices:
  - **Later today**: the task comes back in one hour.
  - **Tomorrow**: the task moves to tomorrow.
  - **Too big: split it**: opens Task Breakdown to cut it into small steps.

Each time you push a task back, its urgency goes up a little, so it does not get lost.

**For a routine**

- **Start routine** opens the full-screen routine player: one step at a time, with a timer. Tap **Step done** (or press the space bar) when a step is done.
- If you close the player, the Now view shows the current step and its own timer. **Step done** moves to the next step.
- **Skip today** frees the routine's time for today.
- When a routine is finished early, the rest of its booked time becomes free for the next task.

**For a calendar event** you only see the countdown until it ends.

On the right (or below, on a phone) you see **Next up**: the next few items with their start time and length.

## Adding tasks (Add)

Write or say the task the way you would tell a friend:

| You type | The app understands |
| --- | --- |
| `Call mom tomorrow at 5pm for 20 min !7` | tomorrow, 17:00, 20 minutes, importance 7, fixed time |
| `Tax report by Friday for 2h` | deadline Friday, 2 hours, placed by the app |
| `Buy milk` | no time: the app fits it into a free slot |

- `!1` … `!10` sets the importance.
- **No double booking:** if the time you ask for is already taken (by a routine, an event or another task), the task goes to the next free slot, and the app tells you why.
- This works offline. With an [AI provider](ai-providers.md) set up, the app understands more varied sentences.

## Routines

A routine is a list of steps with durations (for example *Morning: water 2 min, shower 15 min, breakfast 13 min*), a start time and week days.

- **A routine books its time.** It takes its steps' total time **plus a buffer** (10 % by default) in your day. A 30-minute routine at 07:00 blocks 07:00–07:33, and nothing else can be scheduled there.
- **Two routines can't overlap** on the same day. If you try, Save is refused and the app names the routine in the way.
- The buffer is set in **Settings → General → Routine buffer**.
- **Settings → General → Start the routine player by itself** starts the player automatically when the routine's time begins.
- **Editing steps:** on a phone the editor shows only the step names, so the list stays short. Tap a step to change its duration, move it with the ↑ ↓ arrows, or delete it. On a computer every step shows its duration directly.
- **Changing the order:** drag a step by its handle (⋮⋮) with your finger or the mouse, or use the ↑ ↓ arrows. Tap **Save** to keep the new order.
- You can export and import a routine's steps as CSV from the routine editor.

## The Plan view

- The **strip on top** shows what is happening now or next, with a countdown. **Open** goes to the Now view.
- The **timeline** shows the whole day:
  - orange — routines (booked time, buffer included),
  - purple — tasks with a fixed time,
  - dashed — tasks the app placed for you (they move with the clock until they start),
  - blue — calendar events.
- **Add an event:** tap **+** (or an empty spot of the timeline, which pre-fills that time). The form asks only three things: **what**, **start** and **how long** (one tap: 15, 30, 45, 60, 90 min, or type another number). Importance, urgency, deadline, "do this after" and "pick a task from your list" are folded under **More options**.
- If the time is already taken (routine, event or another task), the form says by what and offers a **Use HH:MM** button with the next free time. Nothing is ever booked on top of something else.
- Tap an event in the timeline to change it, or **Delete** it.
- **Lock plan** pins today's automatic plan, so times stop moving.
- **Plan ahead** lists tasks with deadlines and big tasks (over 30–45 minutes). **Split** sends a task to Task Breakdown so you can cut it into 15–30 minute steps that fit into your day.
- **Delete tasks you no longer need:** the 🗑 button deletes one task; **Delete all overdue (N)** deletes every task whose deadline has passed, in one click. An **Undo** bar stays for 15 seconds. Deleted tasks stay deleted on your other devices too (Google Drive sync).

## Language

Pick English, Deutsch, Français or Español in **More** (flags at the bottom). The Now view, the planner, Add and the routine player follow the language. Some older tools (Pomodoro, Habits, Rewards…) are still partly in English. Without an AI provider, write new tasks in English (the offline parser only understands English); with AI you can write in your language.

## The app adapts to your setup

You only see the options you use:

- **Google Calendar connected** → the `.ics` file / link import and the "How to link calendar" guide are hidden.
- **No AI provider** → **AI Plan** and **AI Breakdown** buttons are hidden.
- **No voice input in your browser** → voice buttons are hidden.

To see everything again, turn on **Settings → General → Show all options**.

## Useful settings (Settings → General)

| Setting | Default | What it does |
| --- | --- | --- |
| Start / end of day | 00:00 / 22:00 | Hours shown and used in the planner |
| Routine buffer | 10 % | Extra time each routine books |
| Pause between tasks | 5 min | Gap the app keeps between two tasks |
| “Next task” countdown window | 15 min | How early the break countdown appears |
| Start the routine player by itself | off | Auto-start routines at their time |
| Show all options | off | Show options your setup doesn't need |

---

[← Back to README](../README.md)
