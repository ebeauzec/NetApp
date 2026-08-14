"""
NetApp Configurator — Reference Data Drift Checker
====================================================
Compares the app's hardcoded version lists (ONTAP_VERSIONS,
STORAGEGRID_VERSIONS in app.js — array index 0 is treated as "the version
this app currently ships as latest") against what tools/harvest_reference_data
just fetched from live sources.

This script never edits app.js. It only reports drift; applying a fix stays
a deliberate, reviewed edit (see README.md's "Checking for Updates" section
and DATA_SOURCES.md's "Update Procedure").

Run standalone:
  python tools/harvest_reference_data.py   # fetch first
  python tools/apply_reference_data.py     # then compare
"""

import json
import os
import re

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(SCRIPT_DIR)
APP_JS_PATH = os.path.join(BASE_DIR, "app.js")

import harvest_reference_data as harvester  # noqa: E402


def _extract_js_array(js_src, const_name):
    """Pulls the string values out of `const NAME = ["a", "b", ...];` in app.js."""
    m = re.search(rf'const\s+{re.escape(const_name)}\s*=\s*\[(.*?)\]\s*;', js_src, re.S)
    if not m:
        return []
    return re.findall(r'"([^"]+)"', m.group(1))


def check_drift():
    with open(APP_JS_PATH, "r", encoding="utf-8") as f:
        app_js = f.read()

    shipped_ontap = _extract_js_array(app_js, "ONTAP_VERSIONS")
    shipped_storagegrid = _extract_js_array(app_js, "STORAGEGRID_VERSIONS")

    live_ontap = harvester.extract_latest_ontap()
    live_storagegrid = harvester.extract_latest_storagegrid()

    drift = []

    if live_ontap is None:
        drift.append({
            "field": "ONTAP_VERSIONS",
            "issue": "Could not determine the latest ONTAP version from endoflife.date (source unreachable or format changed).",
        })
    elif not shipped_ontap:
        drift.append({
            "field": "ONTAP_VERSIONS",
            "issue": "Could not find ONTAP_VERSIONS in app.js to compare against.",
        })
    elif shipped_ontap[0] != live_ontap:
        drift.append({
            "field": "ONTAP_VERSIONS",
            "issue": f"App ships \"{shipped_ontap[0]}\" as the latest ONTAP version; endoflife.date currently reports \"{live_ontap}\".",
            "shipped": shipped_ontap[0],
            "live": live_ontap,
            "shippedHasLive": live_ontap in shipped_ontap,
        })

    if live_storagegrid is None:
        drift.append({
            "field": "STORAGEGRID_VERSIONS",
            "issue": "Could not determine the latest StorageGRID version from docs.netapp.com (source unreachable or page layout changed).",
        })
    elif not shipped_storagegrid:
        drift.append({
            "field": "STORAGEGRID_VERSIONS",
            "issue": "Could not find STORAGEGRID_VERSIONS in app.js to compare against.",
        })
    elif shipped_storagegrid[0] != live_storagegrid:
        drift.append({
            "field": "STORAGEGRID_VERSIONS",
            "issue": f"App ships \"{shipped_storagegrid[0]}\" as the latest StorageGRID version; docs.netapp.com currently reports \"{live_storagegrid}\".",
            "shipped": shipped_storagegrid[0],
            "live": live_storagegrid,
            "shippedHasLive": live_storagegrid in shipped_storagegrid,
        })

    return {
        "shippedOntapLatest": shipped_ontap[0] if shipped_ontap else None,
        "liveOntapLatest": live_ontap,
        "shippedStoragegridLatest": shipped_storagegrid[0] if shipped_storagegrid else None,
        "liveStoragegridLatest": live_storagegrid,
        "drift": drift,
        "clean": len(drift) == 0,
        "note": (
            "Only version currency (ONTAP + StorageGRID) is checked automatically. "
            "Hardware platform additions (new controller models) and best-practice "
            "thresholds (RAID group sizes, spare disk counts) have no stable, "
            "scrapable authoritative source and stay a manual DATA_SOURCES.md-driven "
            "update — see that file's 'What this deliberately does not check' section."
        ),
    }


if __name__ == "__main__":
    harvester.harvest()
    result = check_drift()
    print(json.dumps(result, indent=2))
