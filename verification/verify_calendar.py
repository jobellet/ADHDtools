import os
import re

def verify_calendar_code():
    path = 'calendar-tool.js'
    if not os.path.exists(path):
        print("Error: calendar-tool.js not found")
        exit(1)

    with open(path, 'r') as f:
        content = f.read()

    # Check for new proxy
    if 'https://corsproxy.io/?' in content:
        print("Success: CORS proxy found.")
    else:
        print("Error: CORS proxy not found.")
        exit(1)

if __name__ == "__main__":
    verify_calendar_code()
