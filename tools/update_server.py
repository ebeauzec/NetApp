"""
NetApp Configurator Local Update Helper
=========================================
A small local HTTP server that the app's "Check for Updates" button talks
to. This exists ONLY because a browser page (running from file:// or a
plain local http server) cannot fetch docs.netapp.com / endoflife.date
directly and read the response for anything beyond a simple navigation —
docs.netapp.com sends no Access-Control-Allow-Origin header, so a
cross-origin fetch() from the app's own JS would be blocked by the browser
even though the request itself would succeed server-side.

This local server has a normal network stack (no CORS restrictions apply to
outbound requests it makes) and re-uses harvest_reference_data.py's fetch
logic, then serves the comparison result back to the browser over localhost
with CORS headers this server controls.

This is NOT the shipped app (index.html / NetAppConfigurator_Offline.html)
reaching out on its own — it's an explicit, separate helper the user starts
themselves, and the in-app button only ever talks to 127.0.0.1. Close this
terminal/window and the app goes back to being 100% offline. Nothing here
writes to app.js automatically; it only reports what it finds. Applying a
fix stays a deliberate manual edit, same as the netapp_modeler sibling tool
this pattern was copied from.

Usage:
  python tools/update_server.py
Then in the app: header -> "Check for Updates".
"""

import json
import os
import sys
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

import harvest_reference_data as harvester  # noqa: E402
import apply_reference_data as checker  # noqa: E402

# NetAppModeler's equivalent helper already uses 8765 on this machine; a
# different port lets both tools' helpers run side by side without a
# port-bind conflict.
PORT = 8766


class Handler(BaseHTTPRequestHandler):
    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        # The app is opened via file:// (Origin: null) or a local http server —
        # this server's own CORS policy, not NetApp's, so being permissive here
        # is fine for a purely local, user-initiated tool that never leaves 127.0.0.1.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/health":
            self._send_json(200, {"status": "ok"})
            return

        if path == "/check-updates":
            try:
                print("Fetching latest ONTAP lifecycle data (endoflife.date) and StorageGRID docs (docs.netapp.com)...")
                harvester.harvest()
                result = checker.check_drift()
                result["checkedAt"] = datetime.now(timezone.utc).isoformat()
                self._send_json(200, result)
            except Exception as e:
                self._send_json(500, {"error": str(e)})
            return

        self._send_json(404, {"error": "not found", "routes": ["/health", "/check-updates"]})

    def log_message(self, fmt, *args):
        print(f"[update-server] {self.address_string()} - {fmt % args}")


def main():
    server = HTTPServer(("127.0.0.1", PORT), Handler)
    print(f"NetApp Configurator update helper running at http://127.0.0.1:{PORT}")
    print("In the app: header -> Check for Updates. Ctrl+C to stop (app goes back to fully offline).")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
