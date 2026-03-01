# Transition Plan: Context-Aware Dashboard

This document outlines the implementation steps to transition from the current system to a webpage that automatically displays the appropriate tool based on the time of the day and the user habits.

## Goal
The end goal is for the user not to have to search for the right tool to use at a given time, but for the system to remove cognitive and tool-search burden. For instance, at a certain time of the day the only thing to do is to display a given routine. When it is time to cook, the system just displays the recipe of the day, when it is work time, the system only displays the day plan and pomodoro, etc.

## Step 1: Contextual Trigger System
*   **Define Context Parameters**: Create a system that monitors variables such as time of day, day of the week, active calendar events, and currently scheduled tasks (from `core/scheduler.js`).
*   **Create Context Rules Engine**: Develop an engine to map contexts to specific tools or views. Example rules:
    *   *07:00 - 08:30* & *Routine "Morning" is uncompleted* -> Show **Routine Player** automatically.
    *   *Task active tagged as "[Work]"* -> Show **Pomodoro** and **Day Planner**.
    *   *Calendar event "Lunch"* -> Show specific notes/recipes or a break timer.
*   **User Habit Learning**: Extend `core/duration-learning.js` to log what tools a user opens during specific time blocks. Use this data to suggest or automatically switch contexts.

## Step 2: Adaptive Dashboard (The "Now" View)
*   **Upgrade the Today View**: The current `#today-view` should become the default and *only* view the user sees upon opening the app.
*   **Dynamic Component Loading**: Modify the SPA router (`app.js`) and UI layout to mount only the components relevant to the current context. Instead of a sidebar with 10 tools, the screen should focus solely on the active context.
*   **Seamless Transitions**: Implement smooth transitions when the context changes (e.g., when a routine finishes, automatically transition to the Day Planner for the first work block).

## Step 3: Tool Specific Context Integrations
*   **Routine Tool**: Ensure the routine tool can take over the full screen when a scheduled routine window begins.
*   **Focus Mode / Pomodoro**: Auto-trigger focus mode when a scheduled "Deep Work" task begins.
*   **Day Planner**: Display the planner prominently only during planning phases (e.g., first thing in the morning or end of the day review) or when no strict task is active.

## Step 4: Configuration and Overrides
*   **Manual Override**: The user must always have an easy way to break out of the suggested context (e.g., a "Show all tools" button) in case the system guesses wrong.
*   **Context Settings UI**: Add a section in `settings.js` allowing users to define their daily boundaries (e.g., "Work hours", "Evening wind-down") and associate specific routines/tools with those blocks.

## Step 5: Iteration and Refinement
*   **Feedback Loop**: Add a simple prompt asking the user "Is this the right tool for right now?" to improve the context engine.
*   **Multi-User Context**: Ensure that the context engine respects the active user profile (`core/user-context.js`), displaying the correct tools for family members based on their specific schedules.
