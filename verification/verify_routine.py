import os
from playwright.sync_api import sync_playwright

def verify_routine_tool():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the file
        file_path = os.path.abspath('index.html')
        page.goto(f'file://{file_path}')

        # 1. Create a routine in Settings
        page.click('a[data-tool="settings"]')
        page.click('summary:has-text("Routine Management")')

        # Handle the prompt
        def handle_dialog(dialog):
            print(f"Dialog message: {dialog.message}")
            if "Enter new routine name" in dialog.message:
                dialog.accept("Test Routine")
            else:
                dialog.accept()

        page.on("dialog", handle_dialog)

        # Click Create
        print("Clicking Create New Routine...")
        page.click('#setting-create-routine-btn')

        # Wait for the editor to become visible
        print("Waiting for editor to appear...")
        page.wait_for_selector('#setting-routine-editor', state='visible')

        # Add a task
        print("Adding task...")
        # The add task button is inside the editor, ensure it's visible
        page.click('#setting-add-task-btn')

        # Fill in task details
        print("Filling task details...")
        page.fill('#setting-routine-tasks-list .routine-task-item:last-child .task-name', 'Task 1')
        page.fill('#setting-routine-tasks-list .routine-task-item:last-child .task-duration', '1')

        # Save
        print("Saving routine...")
        page.click('#setting-save-routine-btn')

        # Handle alert "Routine saved!"
        # (Handled by generic dialog handler if blocking, but alerts usually non-blocking in Playwright unless waited for)

        # 2. Go to Routine Tool
        print("Navigating to Routine Tool...")
        page.click('a[data-tool="routine"]')

        # Verify "Next Up: Test Routine"
        print("Verifying Next Up...")
        page.wait_for_selector('h4:has-text("Next Up: Test Routine")')

        # Take screenshot of ready state
        page.screenshot(path='verification/routine_ready.png')

        # 3. Start Routine
        print("Starting routine...")
        page.click('#start-best-match-btn')

        # Verify Running state
        print("Verifying Running state...")
        page.wait_for_selector('h4:has-text("Running: Test Routine")')

        # Take screenshot of running state
        page.screenshot(path='verification/routine_running.png')

        browser.close()

if __name__ == "__main__":
    verify_routine_tool()
