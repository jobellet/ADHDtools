from playwright.sync_api import sync_playwright
import time
import os

def test_tools():
    os.makedirs('suggestion/screenshots', exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:3000")
        page.wait_for_timeout(1000)

        tools = ['pomodoro', 'planner', 'calendar', 'breakdown', 'habits', 'routine', 'focus', 'rewards', 'settings']

        for tool in tools:
            print(f"Testing {tool}...")
            # click on the navigation link
            page.locator(f"a[data-tool='{tool}']").click()
            page.wait_for_timeout(1000)

            # Take a screenshot
            page.screenshot(path=f"suggestion/screenshots/{tool}.png")

            # Additional actions could be added here based on the tool

        browser.close()

if __name__ == "__main__":
    test_tools()
