import os
from playwright.sync_api import sync_playwright

def verify_app_load():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Construct file URL
        file_path = os.path.abspath('index.html')
        url = f'file://{file_path}'

        print(f"Navigating to {url}")
        page.goto(url)

        # Check for console errors
        page.on("console", lambda msg: print(f"Console: {msg.text}"))

        # Wait for app to initialize (look for a known element)
        # app.js creates tool sections and nav links
        page.wait_for_selector("nav", timeout=5000)

        # Take a screenshot
        screenshot_path = os.path.abspath('verification/app_load.png')
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    verify_app_load()
