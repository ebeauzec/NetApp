# NetApp Configurator — Data Sources & Verification Registry

> **PURPOSE:** `ONTAP_VERSIONS` and `STORAGEGRID_VERSIONS` in `app.js` must be
> traceable to an authoritative source and stay current. This document
> records those sources, what the automated checker does and does not cover,
> and the manual procedure for everything it doesn't.
>
> **LAST VERIFIED:** August 15, 2026
> **CURRENT LATEST ONTAP:** 9.19.1 (May 2026)
> **CURRENT LATEST STORAGEGRID:** 12.1

---

## What "Check for Updates" actually checks

The header's **Check for Updates** button re-fetches two live sources and
compares the result against what `app.js` currently ships as the *latest*
entry (index 0) of `ONTAP_VERSIONS` and `STORAGEGRID_VERSIONS`:

| Field | Source | URL | Why this one |
|-------|--------|-----|--------------|
| ONTAP latest version | endoflife.date's ONTAP lifecycle API | `https://endoflife.date/api/netapp-ontap.json` | Clean public JSON, no scraping, no login. Authoritative for GA/EOL dates — this is the same source NetAppModeler's sibling tool uses for its `ONTAP_LIFECYCLE` table. |
| StorageGRID latest version | docs.netapp.com's unversioned StorageGRID docs landing page | `https://docs.netapp.com/us-en/storagegrid/index.html` | Its `<title>` is one of the few statically-rendered strings on `docs.netapp.com` (most pages there are JS-rendered SPA shells whose real body content loads via a follow-up `fetch()` this tool doesn't replicate) and reliably reads `"StorageGRID X.Y software documentation"`. |

`tools/harvest_reference_data.py` fetches both (plain `urllib` + a
self-identifying User-Agent — `docs.netapp.com` doesn't require anything
fancier than that for this particular page); `tools/apply_reference_data.py`
extracts `ONTAP_VERSIONS[0]` / `STORAGEGRID_VERSIONS[0]` from `app.js` with a
regex and reports a mismatch. Neither script edits `app.js`.

**In-app button (v1.6.0):** `tools/update_server.py` is a small local HTTP
server (`127.0.0.1:8766` only) that the button talks to. It exists because
`docs.netapp.com` sends no `Access-Control-Allow-Origin` header, so the app's
own JS can't read a direct cross-origin `fetch()` to that domain even though
the request would succeed — confirmed by inspecting the response headers.
The helper runs the harvest + compare above and reports the result back over
localhost; it never auto-applies a fix to `app.js`. Start it either
automatically via `launch.py` / `launch.bat` / `NetAppConfigurator.bat`
(all three now start it in the background before opening the app) or
manually (`python tools/update_server.py`) — it only ever serves 127.0.0.1.
See `README.md`'s "Checking for Updates" section.

---

## Controller Port Catalog (manually sourced, not auto-checked)

`app.js`'s `getControllerPorts()` returns each platform's real cluster/HA,
storage (NS224), management, and host-data port names, used by both the
cabling diagram (Step 6) and the CLI generator's LIF `-home-port` values so
the two stay consistent. This catalog is **not** re-checked by
`tools/update_server.py` (see the next section) — it was manually sourced
and cross-verified on 2026-08-14 against these `docs.netapp.com` pages:

| Platform family | Source |
|---|---|
| AFF/ASA A1K, A90, A70, C80 | `ontap-systems/a1k/install-cable.html`, `ontap-systems/a70-90/install-cable.html`; confirmed against `asa-r2/install-setup/cable-hardware-a1k.html` and `cable-hardware-a70-90.html` |
| AFF/ASA A900 | `ontap-systems/a900/install-detailed-guide.html` |
| AFF/ASA A50, A30, C60, C30, A20 | `ontap-systems/a20-30-50/install-cable.html`, `ontap-systems/c30-60/install-cable.html`; confirmed against `asa-r2/install-setup/cable-hardware-a20-30-50.html` and `cable-hardware-c30.html` |
| AFF/ASA A400, C400, A250, C250, A150, C800 | Reused from NetAppModeler's already-sourced, zero-drift-verified `js/compatibility.js` catalog (same physical platforms) |
| FAS70, FAS90 | `ontap-systems/fas-70-90/install-cable.html` |
| FAS8300, FAS8700, FAS2820, FAS9500 | Generic onboard SAS scheme, unchanged from the pre-existing catalog |

**Confirmed 2026-08-14**: ASA and ASA r2 platforms share the *identical*
physical ports as their AFF counterparts of the same model (same chassis,
different ONTAP "personality") — direct fetches of the ASA r2 cabling guides
above show the same port names as the AFF guides. The pre-existing catalog
had NOT verified this and used a generic placeholder scheme for nearly every
platform (3 broad buckets covering 30+ distinct model codes), including
misclassifying A900 and C800 into the wrong bucket via an unguarded
`model.includes("A90")`/`.includes("C80")` substring match (both are also
substrings of "A900"/"C800"). See `CHANGELOG.md`'s v1.6.0 entry for the
full list of what changed.

If NetApp restructures one of these platform families' cabling (new I/O
module, new port naming), re-verify against the URLs above and update
`getControllerPorts()` by hand — same process as NetAppModeler's own
`tools/apply_reference_data.py`-driven port corrections, just not yet wired
into an automated checker here.

---

## Cluster Switch Reference Data (manually sourced, not auto-checked)

`generateSwitchConfig()`'s cluster interconnect section (Step 5 / Switch CLI
tab) branches on the selected `clusterSwitchModel`, sourced 2026-08-14:

| Switch | NX-OS/EFOS (current, qualified) | RCF (current) | ISL ports | Source |
|---|---|---|---|---|
| Cisco Nexus 3132Q-V | 9.3(13) | v1.7 | Eth1/31-32 | `github.com/NetAppDocs/ontap-systems-switches/switch-cisco-3132q-v/install-rcf-software-3132q-v.adoc` (confirmed live `show port-channel summary` output); firmware baseline reused from NetAppModeler's `js/compatibility.js` |
| Cisco Nexus 9336C-FX2 | 10.4(2)F | v1.9 | Eth1/35-36 | `.../switch-cisco-9336c-fx2/install-rcf-software-9336c-cluster.adoc` (real RCF banner: port 1-6 breakout, 7-34 node ports, 35-36 ISL); firmware baseline from NetAppModeler |
| NetApp BES-53248 | EFOS 3.10.0.3 | v1.9 | 0/55-0/56 | `.../switch-bes-53248/configure-install-rcf.adoc` (confirmed live `show interface status`/`show port-channel` output); firmware baseline from NetAppModeler |
| NVIDIA SN2100 | n/a (Cumulus Linux, not NX-OS/EFOS) | n/a | n/a | Confirmed real/qualified (ONTAP 9.10.1P3+) via `.../switch-nvidia-sn2100/`, but its CLI is NVUE/`net`-based, not Cisco/Broadcom syntax — the generator emits a pointer to NetApp's own SN2100 install guide instead of fabricating Cumulus commands |

**Node cluster ports now come from `getControllerPorts()`** (the same
sourced catalog the cabling diagram uses) instead of a hardcoded `e0a`/`e0b`
regardless of platform — e.g. an AFF/ASA A90 switched cluster now correctly
shows ports `e1a`/`e7a`, not `e0a`/`e0b`.

**MetroCluster IP RCFs are not a static download** — confirmed via
`github.com/NetAppDocs/ontap-metrocluster/install-ip/using_rcf_generator.adoc`:
NetApp generates them per-deployment (node platform + MetroCluster port
group) through the RcfFileGenerator tool at
`mysupport.netapp.com/site/tools/tool-eula/rcffilegenerator`. The generator
previously fabricated a fixed filename (`N9K_9336C_MetroCluster_IP_v1.8.rcf`);
it now points to the real tool instead and marks the MetroCluster port table
as illustrative pending that tool's exact output for the deployed platform.

**Not covered even by this manual pass**: the exact NX-OS/RCF version
*required for a specific ONTAP release + platform* combination. NetApp gates
that compatibility matrix behind the login-required Switch Compatibility
Table at `mysupport.netapp.com/site/info/cisco-ethernet-switch` (same
Hardware-Universe-style gate documented above) — every switch-config code
block generated by this app includes a line pointing there. The versions
and port structures above are the current, NetApp-qualified baselines, not
a per-platform compatibility claim.

---

## Shelf Provisioning Semantics ("Disks per Node Pair")

The **Disk Count** field on Step 1 is labeled "Disks per Node Pair" and is
the input to `shelfCount = Math.ceil(diskCount / 24)` used throughout the
cabling table, CLI generator, BOM, documentation, and SVG diagrams. This
value is **per HA pair**, not a cluster-wide total -- a physical NS224/
DS224C shelf's storage ports are fully consumed by one HA pair's redundant
multipath wiring, so no two pairs ever share a shelf. Every HA pair in the
cluster (or per MetroCluster site) is provisioned its own full, undivided
`shelfCount` shelves, numbered sequentially and non-overlapping across pairs
(pair 1: Shelf 1..N; pair 2: continues from N+1; ...). Total shelves for the
whole cluster is therefore `shelfCount * numberOfHaPairs`, computed
automatically from the configured node count -- there is no separate manual
"how many shelves do I need" step. See `CHANGELOG.md`'s v1.7.3 entry for the
prior bug this corrected (a `shelfCount / numPairs` division at 12 call
sites that re-divided an already-per-pair value, undersizing every cluster
with more than one HA pair).

`getExpansionCardsAndPorts()` auto-selects and places the PCIe storage
expansion adapter(s) each HA pair needs once its per-pair `shelfCount`
exceeds what the onboard storage ports alone can stack. `maxDirectAttachShelves`
is the authoritative cap used both by `validateForm()` and by the hard cap on
the Step 1 Disk Count dropdown (v1.8.0) -- see the "Real per-platform NS224
max shelf counts" and "Real per-platform SAS (DS224C/DS212C) max shelf
counts" sections below for exactly where each platform's number comes from.
`validateForm()` only raises an error when a configuration genuinely exceeds
that limit; within it, the correct adapter is silently placed into the BOM/
CLI/cabling diagrams with no warning needed. See `CHANGELOG.md`'s v1.7.4
entry.

Expansion-card slot numbers are filtered against every slot already used by
that platform's cluster/storage/data/management ports (`getControllerPorts()`)
before being offered to `slotPriority`, so a card is never placed in a slot
that's already wired for another role (e.g. AFF/ASA A90's cluster occupies
slots 1 and 7 -- an expansion card can no longer be proposed for slot 1). See
`CHANGELOG.md`'s v1.7.6 entry.

### Real per-platform NS224 max shelf counts (v1.8.0)

`getRealMaxNs224Shelves()` returns a real, sourced maximum total NS224 shelves
per HA pair (1 onboard/base + hot-add capacity), used for `getExpansionCardsAndPorts()`'s
`maxDirectAttachShelves` and for the hard cap on the Step 1 Disk Count dropdown.
This **replaces** the PCIe-slot-count formula (`stackSize * (slotsAvailable + 1)`)
for every platform listed below -- that formula was never itself sourced against
real shelf-per-slot ratios and is confirmed wrong (it implied an AFF A400 could
direct-attach up to 8 NS224 shelves; NetApp's own KB caps it at 2).

| Platform | Max NS224 shelves / HA pair | Source |
|---|---|---|
| AFF/ASA A900 | 4 | `github.com/NetAppDocs/ontap-systems/_include/cable-a900-hot-add-shelf.adoc` -- "at least one existing... hot-adding up to three additional" |
| AFF/ASA C800 | 2 | `.../_include/cable-a800-c800-hot-add-shelf.adoc` (shared with A800, not in this tool's platform list) |
| AFF/ASA A400, C400 | 2 | NetApp KB "Is it possible to add more than two NS224 shelves in AFF A400 systems?" (`kb.netapp.com/on-prem/ontap/OHW/OHW-KBs/...`) + `.../_include/cable-a400-c400-hot-add-shelf.adoc` |
| AFF/ASA A250, C250 | 2 | `.../_include/cable-a250-c250-hot-add-shelf.adoc` -- 1 onboard (e2a/e2b) + 1 hot-add (e1a/e1b), single procedure shown |
| AFF/ASA A150 | 1 | Cross-corroborated across two independent vendor/community spec summaries of AFF A150: onboard storage is SAS, not NS224; the mezzanine card slot's RoCE option is described consistently both times as "a 2-port, 100Gb Ethernet, RoCEv2, QSFP28 card for attaching up to one additional NS224 shelf." Still not from a NetAppDocs hot-add guide (none exists for A150) -- **lower confidence than the NetAppDocs-sourced rows above**, but no longer single-source |
| AFF/ASA A1K | 4 | `.../ns224/hot-add-aff-cable-a1k.adoc` -- "hot-add up to three additional NS224 shelves (for a total of four)" |
| AFF/ASA A90, A70, C80 | 2 | `.../_include/cable-70-90-hot-add-shelf.adoc` -- "hot-adding up to two additional shelves" from a base of no external shelves |
| AFF/ASA A50, A30, C60, C30 | 3 | `.../ns224/hot-add-aff-cable-a30-50-60.adoc` -- "hot-add up to two NS224 shelves... when additional storage (to the internal shelf) is needed" (1 internal + 2 hot-add) |
| AFF/ASA A20 | 2 | `.../ns224/hot-add-aff-cable-a20.adoc` -- "hot-add one NS224 shelf... when additional storage (to the internal shelf) is needed" (1 internal + 1 hot-add) |
| FAS70, FAS90, FAS8700, FAS9500, FAS2820 | *not verified* | No NS224 hot-add guide found under `ns224/hot-add-aff-*` or `ns224/hot-add-eoa-*` (the latter covers only end-of-availability A320/A700/FAS500f) for the current FAS lineup. Falls back to the PCIe-slot-count formula -- **not capped by real data**, kept at its previous (wider) range rather than guessing. |

### Real per-platform SAS (DS224C/DS212C) max shelf counts (v1.8.0)

`getRealMaxSasShelves()` covers only the platforms where a real per-platform
limit was found; every other platform keeps the (unverified) PCIe-slot-count
formula. Coverage here is intentionally partial: SAS stack depth and shelf
count are governed by a genuinely different, more configuration-dependent
mechanism than NS224 (`sas3/install-cabling-rules.adoc`'s "port pair"
algorithm -- shelves per stack depends on how many SAS HBA slots and stacks
are cabled, not a fixed per-platform hot-add count), and most current-gen
AFF/ASA platforms are NVMe-native with only lightly documented SAS support.
Critically, where a real number *was* found for a high-end platform (AFF
A400: up to 20 DS224C shelves / 480 disks), it is far beyond this app's
existing disk-count dropdown range (144 disks max already) -- meaning
leaving unlisted platforms uncapped is not known to permit a selection
Hardware Universe would actually reject; the risk is concentrated in
entry-level platforms, which is what was researched:

| Platform | Max DS224C/DS212C shelves / HA pair | Source |
|---|---|---|
| AFF/ASA A150 | 3 | Vendor spec summary: "up to two expansion shelves for a total of 72 SAS SSDs including internal" (72 / 24 = 3) |
| AFF/ASA A250, C250 | 2 | Vendor spec summary: NVMe-native onboard, "maximum of one additional DS224C shelf" -- largely a legacy-migration path rather than a new-deployment scale-out path |

**Still not researched**: DS224C/DS212C limits for every other platform in
this tool (A1K, A900, A400/C400 update pending exact confirmation beyond the
20-shelf A400 data point above, A70/90/C80, A30/50/C30/60, A20, and the FAS
lineup) -- flagged here rather than guessed at.

### Real ONTAP cluster node-count limits (v1.8.0)

The Node Count dropdown now caps at **12 nodes** for any cluster serving a
SAN protocol anywhere (iSCSI, FC, FCoE, NVMe/TCP, NVMe/FC -- checked via
`state.protocols`/`state.protocol`, or unconditionally for `ontapPlatform
=== "asa"` since ASA is SAN-only by definition) and **24 nodes** for
NAS-only (NFS/SMB) clusters, and now offers the previously-missing 16/20/24
options for the NAS case. This is a protocol-wide cluster limit, not a
per-platform hardware one -- confirmed via NetApp's own "Determine the
maximum supported nodes and SAN hosts per ONTAP cluster" guidance
(`docs.netapp.com/us-en/ontap/san-config/determine-supported-nodes-task.html`,
blocked from direct fetch like most of `docs.netapp.com` but its title and
the 12/24 figures are independently corroborated by NetApp Community
threads and long-published cDOT cluster architecture limits) and is
unrelated to the individual-platform shelf research above.

**Not researched**: per-platform maximum node counts *within* those 12/24
ceilings (e.g. whether an entry-level A20 cluster can actually reach 24
NAS nodes, versus a smaller platform-specific ceiling) -- no single public
source enumerating this per platform was found; Hardware Universe is the
authoritative source and remains login-gated.

### Real internal drive bay counts (v1.9.0)

`getInternalBayCount()` returns the number of disk bays built directly into
the controller chassis for platforms where this is genuine (no separate NSM
shelf module, no shelf-to-controller cabling at all for that base capacity)
-- distinct from platforms whose "first shelf" is a real, separately-cabled
NS224 enclosure that just happens to be bundled/co-packaged (AFF/ASA
A70/A90/C80, A1K, A900, C800 -- these are deliberately **excluded** and
still require selecting an external shelf type, consistent with the real
`getRealMaxNs224Shelves()` table above, which already treats their base
unit as consuming "Shelf 1").

| Platform | Internal bays | Source |
|---|---|---|
| AFF/ASA A150 | 24 | Vendor spec summary: "2RU x 24-slot enclosure", same chassis as A250 |
| AFF/ASA A250, C250 | 24 | Vendor spec summary: "space on the frontend provisioned to store up to 24 internal NVMe SSDs" |
| AFF/ASA A400, C400 | 48 | Vendor spec summary: "4U chassis with 48 internal SSD slots" |
| AFF/ASA A20 | 24 | Vendor spec summary: "2U chassis with 24 internal SSD slots" |
| AFF/ASA A30, C30 | 24 | Vendor spec summary (2U variant; a 4U/48-bay variant is mentioned for some SKUs but not modeled here -- see note below) |
| AFF/ASA A50, C60 | 24 | Same source and caveat as A30/C30 |
| FAS2820, FAS2750 | 12 | Vendor spec summary: "2U chassis with 12 drive slots... maximum number of internal drives is 12" |

**Lower-confidence note**: A30/A50 (and their C-series equivalents) are
described in vendor material as available in both 2U/24-bay and 4U/48-bay
chassis configurations; this tool models only the 24-bay figure (the more
conservative, more commonly cited one) since it could not confirm which
specific SKU/configuration corresponds to which bay count. A user who knows
their specific A30/A50/C30/C60 is the 48-bay variant can still reach that
capacity by selecting an external shelf type instead of "Internal".

**Not researched**: A70/A90/A1K/A900/C80/C800's exact internal-vs-bundled-shelf
architecture was ambiguous in available sources (one search described A70/A90
as having "48 internal SSD slots" in an integrated 4U chassis, which would
argue for inclusion here) -- deliberately left out of `getInternalBayCount()`
rather than risk contradicting the already-verified `getRealMaxNs224Shelves()`
figures for the same platforms, which model their base capacity as a real,
separately-cabled NS224 shelf.

## What this deliberately does NOT check

**Hardware platform additions** (new AFF/ASA/FAS/StorageGRID appliance
models, e.g. FAS70/FAS90/AFX/SG6260 added in v1.4.0–v1.5.0). NetApp's
authoritative platform catalog is Hardware Universe (`hwu.netapp.com`),
which sits behind an Azure B2C login wall and isn't scrapable — this is the
same limitation NetAppModeler's `DATA_SOURCES.md` documents for its own
platform registry. There's no other single public page listing "every
currently-shipping NetApp platform" to diff against; individual per-platform
doc pages only help once you already know the model name to check for. New
platforms stay a manual addition when NetApp announces them (as FAS70/FAS90/
AFX/SG6260/SGF6212/SG120/SG1200 all were), driven by the same public
announcements and release notes a human/AI maintainer reads — not this
checker.

**Best-practice thresholds** (RAID group size ranges, spare-disk count
guidance in `validateForm()`'s warnings) come from NetApp Technical Reports
and best-practice guides, which are PDF/marketing-gated documents without a
stable machine-readable source. These stay hand-verified against NetApp TR
documents when revisited, not auto-checked.

**Switch OS versions** (`CISCO_VERSIONS`, `BROCADE_VERSIONS`) — Cisco NX-OS
and Broadcom/Brocade Fabric OS release info sits behind vendor support
logins, not a public unauthenticated page. These stay manually updated when
noticed to be stale.

If any of the above later gets a genuinely scrapable public source, extend
`tools/harvest_reference_data.py` the same way the ONTAP/StorageGRID sources
were added, rather than guessing at one that doesn't reliably work.

---

## Update Procedure

When endoflife.date lists a new ONTAP cycle, or docs.netapp.com's
StorageGRID landing page reports a new version:

1. Click **Check for Updates** in the app (with the helper running), or run:
   ```bash
   python tools/harvest_reference_data.py
   python tools/apply_reference_data.py
   ```
2. If drift is reported, verify it against the source URLs in the table
   above directly in a browser.
3. Edit `app.js`:
   - Prepend the new version to `ONTAP_VERSIONS` or `STORAGEGRID_VERSIONS`
     (index 0 = latest; the UI treats it as the default selection).
   - If a new hardware platform shipped alongside the release, add it to
     `updateSizingDropdownOptions()`'s controller lists and `matchModel()`'s
     ASUP-parsing patterns — see the "What this deliberately does NOT check"
     note above; this part stays manual.
4. Update the "LAST VERIFIED" / "CURRENT LATEST" lines at the top of this
   file.
5. Bump the version in `app.js` (header comment), `index.html` (brand tag),
   `Info.plist`, and add a `CHANGELOG.md` entry.
6. Rebuild the offline bundle: `python bundle_offline.py`
   (`build_app.sh` too, on macOS, if the `.app` wrapper needs updating).
7. Commit, tag, push per this repo's normal process.

---

## Maintenance Schedule

NetApp releases ONTAP approximately twice per year (Q1 and Q2/Q3) and
StorageGRID roughly annually:

| When | Action |
|------|--------|
| January / May-June | Check endoflife.date for a new ONTAP cycle |
| Quarterly | Click Check for Updates, or re-run the harvest scripts |
| Platform/software announcement | Add manually — see the section above |

---

Copyright (c) 2026 Eugene Beauzec. All Rights Reserved.
