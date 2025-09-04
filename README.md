# ADHD Tools Hub

[View Live Website](https://jobellet.github.io/ADHDtools/)

Interactive tools to help manage ADHD symptoms and improve productivity.

## Colab Notebook with Parameters

The website can launch a helper notebook in Colab and pass values through the URL. Replace `jobellet` with your GitHub username if you fork the repo.

```
https://colab.research.google.com/github/jobellet/ADHDtools/blob/main/website_backend.ipynb?filename=demo.json&action=read
```

Inside the notebook any key/value pairs included after the `?` are parsed into a `params` dictionary. The notebook mounts your Google Drive and reads or writes the specified file based on these parameters.

Clicking **Open Colab Backend** on the site now sends your current `localStorage` data to the notebook. Run the notebook to automatically merge this data into `webdata.json` in your Google Drive.

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

All data is stored locally in your browser. Nothing is sent to any server, ensuring your information remains private. An optional Chrome extension is available in `chrome-extension/` if you want to sync your data across devices using Chrome's built‑in sync storage.

## Feedback

If you have suggestions or feedback, please let me know!

## Gemini API Setup

Some tools can use Google Gemini to suggest tasks or categorize items. To enable these features you need a personal API key.

1. **Visit [Google AI Studio](https://aistudio.google.com/)** and sign in with your Google account.
2. **Create a project** if prompted. A name like `ADHD-Tools-Project` works well.
3. **Generate an API key** and copy the long string shown.
4. **Store it securely** – treat this key like a password and never commit it to Git.
5. **Add the key to your browser** by running the following in the developer console:

   ```js
   localStorage.setItem('geminiApiKey', 'PASTE_YOUR_KEY_HERE');
   ```

   The key is saved only in your browser.

## Contributing

If you'd like to contribute, please follow these steps:

1.  **Fork the repository:** Create your own copy of the project.
2.  **Create a new branch:** Make a new branch for your changes (e.g., `feature/new-tool` or `bugfix/timer-issue`).
3.  **Make your changes:** Implement your new feature or bug fix.
4.  **Test your changes:** Ensure your changes work as expected and don't break existing functionality.
5.  **Commit your changes:** Write clear and concise commit messages.
6.  **Submit a pull request:** Push your changes to your fork and open a pull request to the main repository.

## Chrome Sync Extension

The `chrome-extension/` folder contains a minimal extension that syncs your ADHD Tools data using Chrome's cloud storage. It includes small SVG icons (feel free to replace them with your own).

### Downloading the Extension

If you're not familiar with Git, you can download the folder directly from GitHub:

1. Visit [`jobellet/ADHDtools`](https://github.com/jobellet/ADHDtools).
2. Click the **Code** button and choose **Download ZIP**.
3. Extract the archive and locate the `chrome-extension` folder inside.

### Installing on Desktop

To load the extension in Chrome:

1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** and choose **Load unpacked**.
3. Select the `chrome-extension` folder.
4. Make sure you are signed into Chrome with the same Google account on each device you want to keep in sync.
5. Visit the ADHD Tools website (the extension only runs on `jobellet.github.io/ADHDtools/`) and click the extension icon.
6. Sync starts automatically after the extension is installed. Use **Sync Now** to force a manual sync if needed. The popup also lets you clear local or synced data at any time.

### Installing on a Smartphone (Android)

Chrome for mobile doesn't allow extensions, but the free [Kiwi Browser](https://kiwibrowser.com/) does. To make transferring the extension easier, run:

```bash
npm run share-extension
```

This command zips the `chrome-extension` folder and starts a small web server with a QR code. Scan the code with your phone to download the ZIP file, extract it on your device, then open `chrome://extensions` in Kiwi Browser and use **Load unpacked** to select the extracted folder.

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
