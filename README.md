# ADHD Tools Hub

[View Live Website](https://jobellet.github.io/ADHDtools/)

Interactive tools to help manage ADHD symptoms and improve productivity.

## Features

*   **Pomodoro Timer:** Work in focused sprints with timed breaks to maintain productivity.
*   **Eisenhower Matrix:** Prioritize tasks based on importance and urgency.
*   **Day Planner:** Visualize your day with time blocks for better time management.
*   **Task Manager:** Keep track of your to-do list with priorities and categories.
*   **Task Breakdown:** Break complex tasks into smaller, manageable steps.
*   **Habit Tracker:** Build consistency with daily habit tracking and streaks.
*   **Routine Tool:** Create and run daily routines with timed tasks.
*   **Focus Mode:** Minimize distractions with a clean, focused interface.
*   **Rewards:** Celebrate your accomplishments with visual rewards.
*   **Calendar Tool:** Import events from ICS files and integrate them with other tools.

## Privacy

All data is stored locally in your browser. Nothing is sent to any server, ensuring your information remains private.

## Feedback

If you have suggestions or feedback, please let me know!

## Gemini API Setup
Some tools in this application can use the Google Gemini API to provide intelligent suggestions, such as breaking down tasks or categorizing items. Using the API may consume your quota and could incur charges beyond the free tier. See [Google's pricing page](https://ai.google.dev/pricing) for details and keep your key private.

### 1. Obtain Your API Key from Google AI Studio
First, get an API key from Google AI Studio.

**Go to Google AI Studio:** Open [aistudio.google.com](https://aistudio.google.com) and sign in with your Google account.

**Create a Project and Key:** Create a new project (for example `ADHD-Tools-Project`) and generate an API key. Copy this key and store it somewhere safe.

### 2. Add the API Key in the App
On the ADHD Tools website, scroll to the **About** section and find the **Gemini API Key** box. Paste your key into the field and click **Save**. The key is stored only in your browser's `localStorage`. You can remove it at any time by clicking **Clear**.

That's it! The Gemini-powered features in ADHD Tools should now be enabled.

### Troubleshooting
**No key saved:** If the tools say the key is missing, return to the **Gemini API Key** box and re-enter your key. Clearing your browser data will remove the saved key.

**API errors:** Ensure your key is correct and has not been revoked in Google AI Studio.

## Optional Google Calendar Integration

If you want to connect the Day Planner to your Google Calendar, follow these steps:

1. **Create API credentials** – In the [Google Cloud Console](https://console.cloud.google.com/), enable the *Google Calendar API* and create an **API key** and an **OAuth client ID** (type Web application).
2. **Store credentials in the browser** – Open the site and run the following in the browser console:
   ```javascript
   localStorage.setItem('gcalClientId', 'YOUR_CLIENT_ID');
   localStorage.setItem('gcalApiKey', 'YOUR_API_KEY');
   ```
3. **Reload and connect** – Refresh the page and click **Connect Google Calendar**. After authorizing, events from the current day in your primary calendar are saved locally and shown automatically in the Day Planner.

Your credentials remain in your browser only. Remove them anytime with `localStorage.removeItem('gcalClientId')` and `localStorage.removeItem('gcalApiKey')`.

## Deprecated Backend Notebook

Earlier iterations of this project included a `website_backend.ipynb` Colab notebook used for experimentation. The live site now stores all data locally and does not rely on this backend, so the notebook has been removed.

## Contributing

If you'd like to contribute, please follow these steps:

1.  **Fork the repository:** Create your own copy of the project.
2.  **Create a new branch:** Make a new branch for your changes (e.g., `feature/new-tool` or `bugfix/timer-issue`).
3.  **Make your changes:** Implement your new feature or bug fix.
4.  **Test your changes:** Ensure your changes work as expected and don't break existing functionality.
5.  **Commit your changes:** Write clear and concise commit messages.
6.  **Submit a pull request:** Push your changes to your fork and open a pull request to the main repository.

## Importing ICS Files

The Calendar tool can load `.ics` files exported from other apps like Google Calendar or Outlook.

1. Export your calendar as an `.ics` file.
   - In **Google Calendar** open **Settings → Import & export** and choose **Export** to download a ZIP containing your calendars. Extract the `.ics` file from it.
2. Open the **Calendar** tool and click **Import ICS**.
3. Select the `.ics` file and the events will appear in the list and be stored locally.

Only simple events are supported and nothing is uploaded anywhere.

### Loading a Public Google Calendar

Instead of manually exporting files, you can fetch events directly from a public link:

1. In **Google Calendar** open **Settings** and choose your calendar under **Settings for my calendars**.
2. Under **Access permissions for events** check **Make available to public** (Google warns that everything will be visible to anyone with the link).
3. Go to **Integrate calendar** and copy the **Public address in iCal format**.
4. In the Calendar tool paste this link into the **Load ICS URL** field and click **Load ICS URL**. Events will refresh automatically every 30 seconds.

**Privacy Risks:** anyone who has this link can view your calendar details. Share it carefully. To change the link later, disable public sharing (uncheck **Make available to public**) and enable it again to generate a new address or use **Reset private URLs** under **Integrate calendar**.


## License

This project is licensed under the MIT License. See the [LICENSE](https://opensource.org/licenses/MIT) file for details.
