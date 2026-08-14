"""
NetApp Configurator Launcher
==============================
Starts the local update helper (tools/update_server.py) in the background,
then opens NetAppConfigurator_Offline.html in your default browser -- so
"Check for Updates" works immediately instead of failing with instructions
to go start a second terminal by hand.

This script itself never touches the network. It only launches the helper
process (which only ever talks to endoflife.date/docs.netapp.com when you
click "Check for Updates" in the app) and opens a local file in your
browser.

To go back to fully offline, close the helper's console window (or Ctrl+C
in it) -- the app keeps working, the update button just stops connecting.

Usage:
  python launch.py
Or on Windows, double-click launch.bat / NetAppConfigurator.bat.
"""

import os
import subprocess
import sys
import time
import urllib.request
import webbrowser

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
APP_HTML = os.path.join(SCRIPT_DIR, "NetAppConfigurator_Offline.html")
HELPER_SCRIPT = os.path.join(SCRIPT_DIR, "tools", "update_server.py")
HEALTH_URL = "http://127.0.0.1:8766/health"


def helper_already_running():
    try:
        urllib.request.urlopen(HEALTH_URL, timeout=1)
        return True
    except Exception:
        return False


def start_helper():
    print("Starting local update helper (tools/update_server.py)...")
    # A separate visible console on Windows so the user can see it's running
    # and close it whenever they want to go back to fully offline -- same
    # mental model as starting it by hand, just done for them.
    creationflags = subprocess.CREATE_NEW_CONSOLE if sys.platform == "win32" else 0
    subprocess.Popen(
        [sys.executable, HELPER_SCRIPT],
        cwd=SCRIPT_DIR,
        creationflags=creationflags,
    )
    for _ in range(20):
        if helper_already_running():
            print("Update helper is up at http://127.0.0.1:8766")
            return True
        time.sleep(0.25)
    print("Warning: helper didn't respond to a health check yet -- "
          "\"Check for Updates\" may need a retry in a few seconds.")
    return False


def main():
    if not os.path.exists(APP_HTML):
        print(f"Could not find {APP_HTML}")
        print("Run: python bundle_offline.py")
        sys.exit(1)

    if helper_already_running():
        print("Update helper already running at http://127.0.0.1:8766 -- reusing it.")
    else:
        start_helper()

    print(f"Opening {APP_HTML} ...")
    webbrowser.open(f"file:///{APP_HTML.replace(os.sep, '/')}")


if __name__ == "__main__":
    main()
