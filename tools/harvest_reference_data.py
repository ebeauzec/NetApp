"""
NetApp Configurator — Reference Data Harvester
================================================
Fetches the small set of authoritative, reliably-scrapable public sources
that this app's hardcoded version lists (ONTAP_VERSIONS, STORAGEGRID_VERSIONS
in app.js) can be checked against, and saves the raw results to
data/netapp_docs_raw/ plus a manifest at data/netapp_docs_manifest.json.

This script never writes to app.js or index.html. It only fetches and
records; tools/apply_reference_data.py does the comparison and reporting.

Sources used (see DATA_SOURCES.md for why these and not others):
  - endoflife.date/api/netapp-ontap.json  — clean JSON API, no scraping,
    authoritative ONTAP release/EOL lifecycle data.
  - docs.netapp.com/us-en/storagegrid/index.html — the unversioned "latest"
    StorageGRID docs landing page. Its <title> is one of the few static,
    server-rendered strings on docs.netapp.com (most pages there are JS-
    rendered SPA shells whose real body content loads via a follow-up
    fetch() this script does not replicate) and reliably states the
    current GA version, e.g. "StorageGRID 12.1 software documentation".

Run standalone for a dry-run:
  python tools/harvest_reference_data.py
"""

import json
import os
import re
import urllib.request
import urllib.error

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(SCRIPT_DIR)
RAW_DIR = os.path.join(BASE_DIR, "data", "netapp_docs_raw")
MANIFEST_PATH = os.path.join(BASE_DIR, "data", "netapp_docs_manifest.json")

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) NetAppConfiguratorUpdateHelper/1.0"

SOURCES = {
    "ontap_lifecycle": {
        "url": "https://endoflife.date/api/netapp-ontap.json",
        "kind": "json",
        "filename": "ontap_lifecycle.json",
    },
    "storagegrid_landing": {
        "url": "https://docs.netapp.com/us-en/storagegrid/index.html",
        "kind": "html",
        "filename": "storagegrid_landing.html",
    },
}


def _fetch(url, timeout=15):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="ignore")


def harvest():
    """Fetches every source in SOURCES, saves raw output, returns a manifest dict."""
    os.makedirs(RAW_DIR, exist_ok=True)
    manifest = {"sources": {}}

    for key, spec in SOURCES.items():
        entry = {"url": spec["url"], "ok": False, "error": None}
        try:
            raw = _fetch(spec["url"])
            out_path = os.path.join(RAW_DIR, spec["filename"])
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(raw)
            entry["ok"] = True
            entry["bytes"] = len(raw)
            entry["savedTo"] = os.path.relpath(out_path, BASE_DIR)
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as e:
            entry["error"] = str(e)
        manifest["sources"][key] = entry

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    return manifest


def extract_latest_ontap():
    """Reads the harvested endoflife.date ONTAP JSON, returns the latest cycle string or None."""
    path = os.path.join(RAW_DIR, SOURCES["ontap_lifecycle"]["filename"])
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list) or not data:
        return None
    # endoflife.date lists cycles newest-first, but sort defensively by releaseDate.
    def sort_key(entry):
        return entry.get("releaseDate", "")
    latest = max(data, key=sort_key)
    return latest.get("cycle")


def extract_latest_storagegrid():
    """Reads the harvested StorageGRID landing page, extracts the version from its <title>."""
    path = os.path.join(RAW_DIR, SOURCES["storagegrid_landing"]["filename"])
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        html = f.read()
    m = re.search(r"<title>\s*StorageGRID\s+(\d+\.\d+)\s+software documentation", html, re.I)
    if m:
        return m.group(1)
    # Fallback: same phrase anywhere in the page, not just <title> (layout has changed before).
    m = re.search(r"StorageGRID\s+(\d+\.\d+)\s+software documentation", html, re.I)
    return m.group(1) if m else None


if __name__ == "__main__":
    result = harvest()
    print(json.dumps(result, indent=2))
    print("Latest ONTAP (endoflife.date):", extract_latest_ontap())
    print("Latest StorageGRID (docs.netapp.com):", extract_latest_storagegrid())
