
import os
import sys
from playwright.sync_api import sync_playwright

def verify_routine_settings():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the index.html file directly
        file_path = os.path.abspath("index.html")
        page.goto(f"file://{file_path}")

        # Wait for settings button and click it to navigate to settings
        # The navbar links have data-tool attribute
        page.click('a[data-tool="settings"]')

        # Wait for the settings section to be visible
        page.wait_for_selector('#settings.active')

        # Expand Routine Management section
        # It's inside a details element summary "Routine Management"
        page.click('summary:has-text("Routine Management")')

        # Wait for the routine select
        page.wait_for_selector('#setting-routine-select', state='visible')

        # Click Create New Routine button
        # This uses prompt, so we need to handle the dialog
        def handle_dialog(dialog):
            dialog.accept("My Test Routine")

        page.on("dialog", handle_dialog)
        page.click('#setting-create-routine-btn')

        # Wait for the editor to appear
        page.wait_for_selector('#setting-routine-editor:not(.hidden)')

        # Check if the new Import/Export buttons are visible
        export_btn = page.locator('#setting-export-routine-btn')
        import_btn = page.locator('#setting-import-routine-btn')

        if export_btn.is_visible() and import_btn.is_visible():
            print("Export and Import buttons are visible.")
        else:
            print("Error: Export/Import buttons not visible.")
            sys.exit(1)

        # Take a screenshot of the Routine Management section with the editor open
        screenshot_path = os.path.abspath("verification/routine_settings_verification.png")
        # Scroll to the element to ensure it's in view
        page.locator('#setting-routine-editor').scroll_into_view_if_needed()
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    verify_routine_settings()
