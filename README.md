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
Some tools in this application can use the Google Gemini API to provide intelligent suggestions, such as breaking down tasks or categorizing items. To enable these features, you will need to provide your own personal Google Gemini API key.

### 1. Obtain Your API Key from Google AI Studio
First, you need to get a free API key from Google AI Studio.

**Go to Google AI Studio:** Open your web browser and navigate to [aistudio.google.com](https://aistudio.google.com). You'll need to sign in with your Google account.

**Create a New Project:** If you don't already have a project, you may be prompted to create one. A name like `ADHD-Tools-Project` is a good choice.

**Generate Your API Key:**

Once in the dashboard, look for a button or link that says "Get API key" or something similar. This is often in the top-left corner of the page.

Click on "Create API key in new project" or select an existing project if you have one.

A new API key will be generated for you. It will be a long string of letters and numbers.

**Copy Your API Key:** Copy this key to your clipboard. Treat this key like a password and never share it publicly or commit it to a Git repository.

### 2. Add the API Key to Your Browser
To make the API key available to the ADHD Tools website, you need to save it in your browser's local storage.

**Open Developer Tools:** On the ADHD Tools website, open your browser's developer tools. You can usually do this by:

* Pressing `F12` on your keyboard.
* Right-clicking on the page and selecting **Inspect**.

**Go to the Console:** In the developer tools panel, find and click on the **Console** tab.

**Save the API Key:** In the console, you will run a command to save your key. Copy the following line of code, paste it into the console, and replace `PASTE_YOUR_KEY_HERE` with the API key you copied from Google AI Studio:

```javascript
localStorage.setItem('geminiApiKey', 'PASTE_YOUR_KEY_HERE');
```

After pasting your key, press Enter.

### 3. Verify the API Key is Saved
You can quickly check if the key was saved correctly.

In the same developer console, type the following command and press Enter:

```javascript
localStorage.getItem('geminiApiKey');
```

The console should display your API key. If it shows `null` or is blank, please repeat the steps above.

That's it! The Gemini-powered features in the ADHD Tools should now be enabled.

### Troubleshooting
**"Gemini API key not found" Error:** This error means the key is not saved in your browser's `localStorage`. Make sure you have completed all the steps correctly. If you clear your browser's cache or use a different browser, you will need to add the key again.

**API Errors:** If you get other errors, ensure that your API key is correct and has not been revoked. You can manage your API keys in the Google AI Studio dashboard.

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
