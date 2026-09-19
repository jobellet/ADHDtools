# ADHD Tools Hub User Testing Report

## Overview
This report details the findings from testing the various tools in the ADHD Tools Hub application from a user's perspective, along with suggestions for improvement.

## Testing Setup
- Ran local Python HTTP server on port 3000.
- Used Playwright to simulate user navigation through all major tools: Pomodoro, Planner, Calendar, Task Breakdown, Habit Tracker, Routine Tool, Focus Mode, Rewards, and Settings.
- Screenshots for each tool were captured to visually inspect the UI layout.

## Tool-by-Tool Feedback

### 1. Pomodoro Timer
**Observations:** The timer functionality is clear. Settings are noted to be moved to the global settings panel, which reduces clutter in the tool itself.
**Suggestions for Improvement:**
- A simple visual cue (like the background color slowly filling up) might be more engaging than just numbers and a progress bar.
- Add an option to input the specific task being focused on directly into the timer view.

### 2. Day Planner
**Observations:** Provides a structured way to plan the day. Adding events via a modal is functional.
**Suggestions for Improvement:**
- Drag-and-drop functionality for reordering tasks or adjusting their duration directly on the timeline would make it much more intuitive.
- The "Fill from Calendar & Tasks" button is good, but it would be better if this could be set to auto-fill at the start of each day.

### 3. Calendar
**Observations:** Currently just acts as a viewer with side tabs for a guide. Importing is moved to settings.
**Suggestions for Improvement:**
- It feels a bit empty without tasks visible in the Day/Week/Month view out of the box.
- Allow clicking directly on empty slots in the calendar to quickly create an event, bypassing the need to always go to the planner or settings.

### 4. Task Breakdown
**Observations:** Sourcing tasks from the existing pending list rather than free text is a smart constraint for ADHD users to avoid duplicating work.
**Suggestions for Improvement:**
- An "AI Breakdown" button exists, but manually adding subtasks feels tedious if the AI doesn't get it right. Ensure the manual subtask adding interface is very streamlined (e.g., hitting enter instantly creates a new subtask line).

### 5. Habit Tracker
**Observations:** The split layout between habit list and calendar is clean.
**Suggestions for Improvement:**
- Gamify it slightly more—perhaps visually link the habit streak to the rewards points system if it isn't already directly tied.
- Provide visual "streak flames" for consecutive days.

### 6. Routine Tool
**Observations:** Extremely feature-rich with a dedicated editor in the same view (per user preference memory). The auto-run and skip functions are vital for ADHD users.
**Suggestions for Improvement:**
- When a task is skipped, provide an optional quick reason (e.g., "didn't have time", "not feeling it") to help with the `DurationLearning` data.
- The Pie Chart is good, but a linear progress bar (like the one in Focus Mode) might be easier to process at a glance for some users.

### 7. Focus Mode
**Observations:** Minimalist and distraction-free as promised.
**Suggestions for Improvement:**
- Include a small "notepad" or "brain dump" section off to the side so if a distracting thought occurs, the user can jot it down and return to focus without breaking context.

### 8. Rewards
**Observations:** The point system for completing tasks and claiming them in the evening review is a great mechanism.
**Suggestions for Improvement:**
- Give users some default rewards (e.g., "15 min YouTube break - 10 pts") so they don't have to invent them all from scratch.
- Add an animation (like confetti) when a reward is claimed.

### 9. Settings
**Observations:** Comprehensive, moving complex settings here keeps the main tools clean.
**Suggestions for Improvement:**
- It's a bit overwhelming. Categorize settings further or add a search bar within the settings tab to quickly find things like "Pomodoro sound".

## General App Architecture Suggestions
- **Unified Onboarding:** When a user first opens the app, guide them through setting up their first task, starting a Pomodoro, and claiming a reward to show the cycle.
- **Context-Aware Dashboard:** (Already noted in `transition_plan.md`) This should be prioritized. The user shouldn't have to choose which tool to look at; the app should surface the Routine player in the morning, Planner midday, and Rewards in the evening.
