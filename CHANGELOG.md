# Changelog

All notable changes to the NetApp Solutions Architect Configurator will be documented in this file.

## [1.9.2] - 2026-08-15

### Fixed
- **Shelf-Overflow Error Message Ignored Internal Bays**: The "Shelf Count Exceeds
  Direct-Attach Capacity" validation error (a defense-in-depth backstop for out-of-range disk
  counts, e.g. from an imported config) told the user to reduce Disk Count to the platform's
  *external-shelf-only* maximum, silently ignoring any real internal bays -- e.g. an AFF A90
  (48 internal bays + 2 external shelves) with an out-of-range disk count was told to reduce to
  48, when the real combined maximum is 96. The message now reports the true combined
  internal+external ceiling and clarifies how many of those disks need no shelf at all.

## [1.9.1] - 2026-08-15

### Fixed
- **AFF/ASA A70, A90, C80, and A1K Were Missing the "Internal" Shelf Option**: v1.9.0's
  internal-bay research found ambiguous evidence for these platforms and left them out to avoid
  contradicting the existing external-shelf table. On review, NetApp's own hot-add documentation
  explicitly states A70/A90/C80's baseline HA pair "has only internal storage (no external
  shelves)" before any hot-add procedure begins, corroborated independently by a
  48-internal-SSD-slot 4U chassis spec -- strong enough evidence to include them (now 48 bays).
  A1K is also now included (24 bays, its bundled 2RU x 24-slot storage chassis), applied for
  consistency with the rest of the table at explicit user request -- its own hot-add doc calls
  the baseline "1 existing NS224 shelf" rather than "internal storage", a meaningfully weaker
  evidentiary basis than A70/90/C80's, documented as such in `DATA_SOURCES.md`. A900 and C800
  remain excluded -- no bundled-chassis or "internal storage" language was found for either.
- **Selecting an External Shelf Type on an Internal-Bay Platform Ignored the Internal Capacity
  Entirely**: `getShelfCount()` (and the disk-count dropdown cap, the BOM's shelf-quantity line,
  and the capacity solver) previously shelved the *entire* disk count whenever an external shelf
  type (NS224/DS224C/DS212C) was selected, even on a platform with real internal bays -- e.g. an
  AFF A90 (48 internal bays) with 60 disks and NS224 selected computed 3 external shelves
  (`ceil(60/24)`) instead of the correct 1 (the first 48 disks need no shelf at all; only the
  remaining 12 do: `ceil((60-48)/24)`). Internal capacity is now always consumed first --
  external shelves are only provisioned for the overflow beyond it -- across cabling, CLI, BOM,
  documentation, SVG diagrams, the disk-count dropdown's hard cap, and the capacity solver's
  achievable range, all of which now correctly reflect the combined internal+external maximum.

### Changed
- **README Updated for v1.9.0**: Added a "What's New in v1.9.0" summary (Internal shelf option,
  Target Usable Capacity solver, the controller-switch re-cap fix) to the README's version
  history -- it had been left at the v1.8.1 summary after that release shipped.

## [1.9.0] - 2026-08-15

### Added
- **"Internal (No External Shelf)" Drive Shelf Option**: Platforms whose disks sit directly in
  the controller chassis (AFF/ASA A150, A250/C250, A400/C400, A20, A30/C30, A50/C60, and
  FAS2820/FAS2750 -- see `DATA_SOURCES.md` for sourced bay counts) now offer "Internal" as a
  Drive Shelf Type choice, alongside NS224/DS224C/DS212C. Selecting it produces a configuration
  with zero external shelves: no shelf boxes in the cabling diagrams, no shelf cabling rows, no
  Storage Expansion Shelf or PCIe expansion card BOM line items, and the Disks per Node Pair
  field is capped at that platform's real internal bay count instead of a shelf-stacking limit.
  Previously every platform was forced to select at least one external shelf's worth of disks
  (minimum 12) even when its actual base capacity is disks built into the controller itself.
- **"Target Usable Capacity" Sizing Input**: An optional field on Step 1 that reverse-solves the
  minimum Disks per Node Pair needed to reach a target cluster-wide usable capacity (in GB or
  TB), given the currently selected controller, shelf type, disk size, RAID type/group size, and
  spare disk count. Lets an architect size from "I need 50TB usable" directly instead of
  iterating on disk count by hand; the solved value is capped at the platform's real hard limit
  (see below) and clearly flags when a target isn't achievable on the current platform/shelf
  choice. Re-solves automatically if a dependent field (RAID settings, disk size, node count,
  shelf type, controller) changes while a target is still set.

### Fixed
- **Switching Controllers Never Re-Capped Disks per Node Pair**: Changing the Controller Model
  dropdown had no listener wiring to re-run the shelf-type/disk-count option rebuild at all --
  the v1.8.0/v1.8.1 hard caps only took effect on initial page load or platform switch, not when
  interactively picking a different controller. Worse, even where the rebuild *did* run, a
  pre-existing "preserve a value the preset list doesn't have" fallback (meant for odd
  ASUP-parsed values) unconditionally re-added the previous disk count into the dropdown even
  when it exceeded the newly-selected platform's real cap -- e.g. switching from an AFF A1K (96
  disks/pair) to an AFF A150 (24 disks/pair) silently kept 96 selected and offered. Both fixed:
  the controller dropdown now re-triggers the full option rebuild, and the fallback no longer
  re-adds a value beyond the current platform/shelf's real maximum.

## [1.8.1] - 2026-08-15

Closes out the gaps explicitly flagged as unresearched in v1.8.0's `DATA_SOURCES.md` update:
DS224C/DS212C (SAS) shelf limits and ONTAP cluster node-count limits.

### Added
- **Real SAS (DS224C/DS212C) Shelf Caps for AFF/ASA A150, A250, C250**: Added
  `getRealMaxSasShelves()`, sourced the same way as v1.8.0's NS224 table. AFF/ASA A150 caps at
  3 shelves (72 disks); A250/C250 cap at 2 (48 disks) -- both platforms where the tool's
  previous unconstrained range (up to 144 disks / 6 shelves) meaningfully exceeded real
  capacity. Coverage is intentionally partial: SAS stack depth is far more configuration
  dependent than NS224's roughly-fixed hot-add counts, and the one high-end data point found
  (AFF A400: up to 20 DS224C shelves / 480 disks) is already far beyond this tool's disk-count
  range, so leaving other platforms uncapped here is not known to permit an unsupported
  selection. See `DATA_SOURCES.md`.
- **Real ONTAP Cluster Node-Count Cap by Protocol**: The Node Count dropdown previously offered
  the same `[2, 4, 6, 8, 12]` regardless of platform or protocol. It now caps at 12 nodes for
  any cluster serving a SAN protocol (iSCSI/FC/FCoE/NVMe over TCP or FC) anywhere, or
  unconditionally for ASA (SAN-only by definition) -- and at 24 nodes, with the
  previously-missing 16/20/24 options now offered, for NAS-only (NFS/SMB) clusters. This is a
  real, sourced ONTAP-wide cluster architecture limit (NetApp's "Determine the maximum
  supported nodes and SAN hosts per ONTAP cluster" guidance), not platform-hardware-specific.

## [1.8.0] - 2026-08-15

Full-codebase audit against NetApp's own hardware documentation, prompted by a request to
find any remaining hidden issues in the same class as v1.7.3-v1.7.6 and to make the tool
physically incapable of producing an unsupported configuration. Combines a systematic manual
+ agent-assisted review of every generator function with new externally-sourced NetApp
platform data (github.com/NetAppDocs, NetApp Knowledge Base -- see `DATA_SOURCES.md`).

### Added
- **Hard Cap on Disks per Node Pair**: The Disk Count dropdown on Step 1 now only offers values
  that the selected controller can actually direct-attach cable for the selected shelf type --
  it is no longer possible to select a configuration this tool cannot physically support. The
  cap is driven by real, sourced per-platform NS224 shelf limits (`getRealMaxNs224Shelves()`,
  see below); platforms without a published NS224 hot-add guide (currently the FAS lineup) keep
  the previous, wider range rather than guessing at an unverified limit.
- **Real Per-Platform NS224 Shelf Limits**: Added `getRealMaxNs224Shelves()`, sourced directly
  from NetApp's per-platform NS224 hot-add cabling guides and Knowledge Base, replacing the
  PCIe-slot-count formula that `maxDirectAttachShelves` (v1.7.4) was previously derived from.
  That formula turned out not to match reality: it implied an AFF A400 could direct-attach up
  to 8 NS224 shelves, but NetApp's own KB caps it at 2 (confirmed: A1K=4, A900=4, A400/C400=2,
  A250/C250=2, A150=1, A70/A90/C80=2, C800=2, A30/A50/C30/C60=3, A20=2). The formula remains as
  a documented, lower-confidence fallback for shelf types and platforms without sourced data.

### Fixed
- **(Critical) Aggregates Were Only Ever Created on the First HA Pair**: `generateOntapCliCode()`
  and `generateAnsiblePlaybook()` hardcoded `storage aggregate create` (and the equivalent
  `na_ontap_aggregate` task) to exactly two aggregates on `node1`/`node2`, with no loop over the
  cluster's other HA pairs -- unlike the `storage port modify` loop just above it, which
  correctly iterates every node. On an 8-node (4-pair) cluster, the generated script enabled
  storage ports on all 8 nodes but created aggregates on only the first 2 -- nodes 3-8 were left
  completely unprovisioned. Volume placement had the same bug: every volume round-robined onto
  only `aggr_data_1`/`aggr_data_2` (`idx % 2`) regardless of cluster size. Both generators now
  loop over every HA pair (`aggr_data_1` through `aggr_data_N`, one pair of aggregates per HA
  pair) and round-robin volumes across all of them (`idx % nodeCount`).
- **Capacity Calculator Assumed Exactly 2 Aggregates Cluster-Wide**: `recalculateCapacity()` and
  `generateDeploymentGuide()` both computed `disksPerAggr = totalDisks / 2`, the same "flat 2
  aggregates" assumption as the bug above, baked directly into the capacity math. This
  undercounted parity overhead (and therefore overstated usable/logical capacity) for any
  cluster with more than one HA pair -- confirmed by the fix now scaling perfectly linearly per
  pair (a 4-pair cluster reports exactly 4x a 1-pair cluster's usable capacity; it previously
  did not). Both now compute one aggregate per node.
- **DS212C Shelf Count Was Computed as if It Were a 24-Bay Shelf**: Every `shelfCount =
  Math.ceil(diskCount / 24)` calculation (11 call sites: cabling table, CLI, BOM, HLD/LLD docs,
  all SVG diagrams) hardcoded 24 disks per shelf, but DS212C is a real 12-bay LFF SAS shelf, not
  24-bay like NS224/DS224C -- undercounting DS212C shelves (and therefore cabling, PCIe card
  sizing, and generated CLI) by half. Added `getShelfBayCount(shelfType)` and fixed every call
  site to use it. One BOM line item (`shelfQty`) already handled this correctly and was
  untouched.
- **LUN Size Overprovisioning Check Ignored Unit Mismatches**: `validateForm()` summed
  `lun.size` across a volume's LUNs and compared the raw sum to `vol.size` with no unit
  conversion, even though LUN size and volume size are independently selectable in GB or TB.
  A 1TB volume with two 500GB LUNs (exactly at capacity) was incorrectly flagged as
  "Overprovisioned Volume Space" (`1000 > 1`); the reverse case (a small-GB volume with a
  large-TB LUN) could equally go undetected. Now normalizes both sides to GB before comparing,
  matching the pattern already used correctly by the "Aggregate Level Capacity" check ~60 lines
  below it in the same function.
- **Bill of Materials Hardcoded an "AFF-" Part-Number Prefix for Every Platform**: The
  "Controller Pair" BOM line always prepended `AFF-` to `state.sizing.controller`, even though
  that field's format already varies by platform: ASA values are pre-prefixed (`ASA_A90`) and
  FAS values are plain (`FAS9500`). This rendered nonsensical part numbers like `AFF-ASA_A1K`
  (double-branded, wrong family) and `AFF-FAS9500` (a hybrid FAS array mislabeled as All-Flash)
  on this customer-facing procurement document. Now derives the correct prefix (or none) from
  `state.ontapPlatform`.

## [1.7.6] - 2026-08-15

### Fixed
- **Storage Expansion Card Slot Numbers Collided With Real Cluster/Data Ports**: `getExpansionCardsAndPorts()`'s per-platform `slotPriority` arrays (which PCIe slot to place the 1st/2nd/... storage expansion card in) were defined independently of the sourced controller port catalog in `getControllerPorts()`, and were never cross-checked against it. For the A1K/A90/A70/C80 family, whose cluster interconnect already occupies PCIe slots 1 and 7 (`e1a`/`e7a`), the expansion-card logic proposed slot 1 for the *first* storage card too -- rendering the literal label `e1a` twice in the same node's port row, once as the cluster port and once as a storage-adapter port, which is physically impossible (one slot, two roles). A900/C800/A400/C400/A1K also had smaller, less visible versions of the same collision. Expansion-card slots are now filtered against every port number already in use by that platform's cluster, onboard storage, data, and management ports, so no slot is ever proposed twice for two different roles. This also slightly reduces the real PCIe expansion capacity (and therefore `maxDirectAttachShelves`, see v1.7.4) for the affected platforms, since some of their previously-listed "available" slots were never actually free. Also fixed a regression from v1.7.4 where the `slotPriority` variable's `let` declaration was accidentally dropped, which would throw or silently reuse a stale value from a prior call for any unrecognized controller model.

## [1.7.5] - 2026-08-15

### Fixed
- **All Nodes' Cables Visually Converged on a Single Point on Each Switch**: In `generateSvgPhysicalCabling()`'s standard (non-MetroCluster) diagram, every node's cable to the cluster switches, management switch, and data switches ended at the exact same hardcoded coordinate regardless of which node it came from -- e.g. all 4 nodes' Data Fabric B cables ended at the literal same `(650, dataBY + 25)` point. This rendered as every cable appearing to plug into one shared port, even though each node's cabling table row (Step 6) already had its own distinct, correctly-numbered destination port. Each node's cable endpoint is now fanned out to its own position along the destination switch's edge (spaced evenly by node index), so the diagram visually matches the 1:1 port assignments the underlying cabling data already had.

## [1.7.4] - 2026-08-15

### Fixed
- **"High Shelf Count for Direct Cabling" Warned Regardless of Platform, and the BOM/Docs Line It Pointed To Was Blank**: The warning fired on a blanket ">2 NS224 shelves" rule for every platform, telling the user to "verify you have enough onboard or adapter ports" themselves -- even though `getExpansionCardsAndPorts()` already auto-selects and places the correct PCIe expansion adapter(s) into the BOM, CLI, and cabling diagrams for exactly this situation. That auto-provisioning was itself broken: it returned `{cardModel, slot, ports}`, but the Bill of Materials and HLD/LLD documentation generators read `card.partNumber` / `card.description` -- fields that never existed -- so the "Storage PCIe Expansion Card" BOM line rendered with a blank description and part number. Fixed the field mismatch (`getExpansionCardsAndPorts()` now returns real `partNumber`/`description`, e.g. `X1148A` / "2-Port 100GbE RoCE QSFP28 NVMe Storage HBA"), and replaced the generic warning with a real per-platform capacity check: each platform's actual PCIe expansion-slot count (already tracked internally as `slotPriority`) now determines the true maximum direct-attach shelf count (e.g. AFF A150's single mezzanine slot supports up to 4 NS224 shelves per HA pair, not the previous blanket "2"). Configurations within that real limit no longer show any warning at all -- the correct adapter is auto-placed and shown in the BOM/CLI, nothing for the user to act on. Configurations that genuinely exceed the platform's physical slot count now raise an actionable error naming the exact shelf/disk-count limit and recommending a switched storage fabric, instead of the previous vague "verify" message -- and the function no longer fabricates slot numbers beyond what a platform actually has when a configuration does overflow.

## [1.7.3] - 2026-08-15

### Fixed
- **Shelf Provisioning Divided an Already-Per-Pair Disk Count, Undersizing Every Cluster With More Than One HA Pair**: The v1.7.2 fix stopped HA pairs from oversubscribing a shared shelf, but the root cause went deeper than that single fix reached. `state.sizing.diskCount` is labeled "Disks per Node Pair" -- the `shelfCount` computed from it (`Math.ceil(diskCount / 24)`) is therefore already a **per-pair** shelf count, not a cluster-wide total to be split across pairs. Twelve separate call sites across the app (the Step 6 cabling table, `cabling_topology.txt`, the ONTAP CLI's storage-port-enable section, the BOM's PCIe expansion card line item, the HLD/LLD documentation generator, and all four SVG cabling-diagram generators) computed `shelvesPerPair = Math.ceil(shelfCount / numPairs)`, dividing an already-per-pair number by the pair count a second time. On a 6-node cluster (3 HA pairs) with the default 1-shelf-per-pair configuration, this correctly-should-be-3-shelf cluster was drawn with a single shared shelf, and its cabling lines/expansion-card sizing were computed for a fractional shelf count -- the exact "3 shelf boxes, one looking disconnected" artifact reported against an A150 6-node cluster. Every pair now gets its own full, undivided `shelfCount` shelves, numbered sequentially and non-overlapping across pairs (pair 1: Shelf 1..N, pair 2: continues from N+1, ...). The now-incompatible-units "Insufficient Shelves for HA Pair Count" validation warning added in v1.7.2 (which compared total pair count against a per-pair shelf count) has been removed since the underlying shortage it warned about no longer exists -- shelf count is now provisioned automatically from node count, with no user action required.
- **Physical Cabling SVG Diagrams Capped at 4 Nodes Also Capped Shelves to the Wrong Amount**: The two physical-cabling SVG generators (`generateSvgPhysicalCabling`, `generateSvgStorageOnlyCabling`) intentionally draw only the first 4 nodes (2 HA pairs) of larger clusters to avoid an unbounded canvas, but their shelf count was pinned to a single pair's `shelfCount` regardless of how many pairs were actually drawn -- so a 2-pair preview showed only 1 pair's worth of shelves, silently dropping the second visible pair's storage. Shelf count shown is now scoped to `ceil(visibleNodes / 2) * shelfCount`, matching the pairs actually drawn; the "Displaying first 4 nodes" note now also mentions that shelves are scoped to those same pairs, and points to the full Step 6 cabling table for the complete cluster.

## [1.7.2] - 2026-08-14

### Fixed
- **Storage Cabling Diagram Oversubscribed Shared Shelves**: The v1.7.1 fix that stopped HA pairs from being silently dropped from the cabling diagram (when disk count implied fewer shelves than HA pairs) cycled extra pairs back onto an *already-fully-wired* earlier shelf instead of giving them their own. On a 4-node cluster with the default 24-disk/1-shelf configuration, this drew both HA pairs (4 independent controllers) all connected to the same single NS224 shelf's 4 physical storage ports -- a shelf's ports are fully consumed by one HA pair's redundant multipath wiring, so two separate pairs can never physically share one. Each pair beyond the configured shelf count now gets its own additional shelf number (Shelf 2, Shelf 3, ...) instead of reusing one another pair already occupies. Added a matching "Insufficient Shelves for HA Pair Count" validation warning explaining the gap and how to fix it (increase Disk Count, or reduce Node Count).

## [1.7.1] - 2026-08-14

### Fixed
- **Cabling Table/Diagram Still Used Generic Port Numbers**: v1.7.0 fixed the Switch CLI tab's cluster port numbering but missed a second, separate code path -- `generateCablingRows()` (the Step 6 "Dynamic Port Cabling Matrix" table, `cabling_topology.txt`, and MetroCluster per-site cabling) still numbered every cluster switch's node ports starting at Port 1 regardless of the selected switch model. A Nexus 9336C-FX2 switched cluster showed cluster1-01/02 on "Port 1"/"Port 2" instead of the real `Eth1/7`/`Eth1/8` (ports 1-6 on that switch are reserved for legacy breakout, per its RCF banner). Extracted the per-model port numbering into a shared `getClusterSwitchPortLabel()` used by both the cabling table and the Switch CLI generator, so they can no longer drift apart.

## [1.7.0] - 2026-08-14

### Added
- **Cisco Nexus 9336C-FX2 Cluster Switch**: Added as a selectable cluster switch model (shared cluster/storage switch, ONTAP 9.9.1+) alongside the existing Nexus 3132Q-V, NVIDIA SN2100, and NetApp BES-53248 options.

### Fixed
- **Cluster Switch Config Was Generic Regardless of Selected Model**: `generateSwitchConfig()`'s cluster interconnect section ignored the selected `clusterSwitchModel` entirely and always emitted the same fabricated RCF filename/version and port range no matter which switch was chosen. Now branches per model with real, sourced NX-OS/EFOS versions, RCF filenames, and ISL port assignments (see `DATA_SOURCES.md`'s new "Cluster Switch Reference Data" section) -- e.g. selecting Nexus 9336C-FX2 now correctly shows NX-OS 10.4(2)F, RCF v1.9, and ISL on Eth1/35-36, instead of the 3132Q-V's Eth1/31-32 being shown regardless of the switch actually selected.
- **Switch Config Used Wrong Cluster Port Names Per Platform**: The port-mapping table hardcoded `e0a`/`e0b` for every controller regardless of platform, so an AFF/ASA A90 switched cluster showed the wrong ports. Now sourced from the same `getControllerPorts()` catalog the cabling diagram uses (e.g. A90 correctly shows `e1a`/`e7a`).
- **Fabricated MetroCluster IP RCF Filename**: NetApp generates MetroCluster IP RCFs per-deployment via their RcfFileGenerator tool, not as a static download; the generator invented a fixed filename instead. Now points to the real tool and marks the port table as illustrative pending that tool's output.
- **NX-OS Version List Used the Wrong Format**: `CISCO_VERSIONS` used a dotted format ("9.3.9") that doesn't match how Cisco actually publishes NX-OS releases ("9.3(13)", "10.4(2)F"); `versionToNum()` also couldn't parse the real format (would silently return `NaN` and disable the modern-syntax code paths gated on it). Fixed the version list and made `versionToNum()` parse the real format correctly.

## [1.6.0] - 2026-08-14

### Added
- **"Check for Updates" Button**: Header button that checks whether the app's hardcoded `ONTAP_VERSIONS` / `STORAGEGRID_VERSIONS` lists still match the latest publicly released versions. Talks only to a local helper the user starts themselves (`tools/update_server.py`, `127.0.0.1:8766`) -- the app never reaches the internet on its own; see `DATA_SOURCES.md`.
- **Update Tooling**: `tools/harvest_reference_data.py` fetches endoflife.date's ONTAP lifecycle API and the docs.netapp.com StorageGRID docs landing page; `tools/apply_reference_data.py` compares them against `app.js` and reports drift without auto-editing anything; `tools/update_server.py` exposes both over a local-only HTTP server for the in-app button.
- **One-Step Launcher**: `launch.py` (and `launch.bat`) starts the update helper in the background and opens the offline app in one step. `NetAppConfigurator.bat` now does the same automatically (best-effort, skipped silently if Python isn't installed) before launching Edge.
- **`DATA_SOURCES.md`**: Documents every source the update checker relies on, what it deliberately does not check (hardware platform additions, RAID/spare-disk best-practice thresholds -- no stable scrapable authoritative source exists for either), and the manual update procedure for maintainers.
- **Persistent Update-Check Cache**: The last "Check for Updates" result is cached in `localStorage` and shown as a "Last verified" badge next to the button on every page load, so the app doesn't need the helper running just to show when it was last confirmed current. The badge and cache are only ever overwritten by the next successful check.

### Fixed
- **Crash on Example-Data Buttons**: The "NFS & iSCSI CLI" / "FC SAN CLI" / "NVMe & S3 CLI" buttons on Step 1 threw `ReferenceError: ASUP_EXAMPLES is not defined` (leftover from the v1.4.0 removal of `asup_examples.js` that didn't also remove the buttons referencing it). Removed the dead buttons.
- **Capacity Calculator Overflow**: The sizing calculator's spare/parity disk capacity wasn't clamped against total raw capacity -- with the Spare Disks input's own allowed range on a small disk/node count, the "Spares" + "Parity" segments could sum to more than "Total Raw" (e.g. 76TB of parts vs. 45.6TB total). Now clamped consistently in both the live capacity visualization and the generated Deployment Guide.
- **Broken "Download Source" Link**: The offline-mode fallback alert pointed to a nonexistent repo (`ebeauzec/netapp-configurator`); corrected to `ebeauzec/NetApp`. The file list also referenced 3 files removed in v1.4.0 (`asup_examples.js`, `sevenzip_js.js`, `sevenzip_wasm.wasm`); removed.
- **Controller Port Catalog Was Fabricated Placeholder Data**: `getControllerPorts()` grouped nearly every platform onto 3 generic port schemes (`e0a-e0f`, or `e1a/e1b`+`e2a/e2b`+`e3a/e3b`) that didn't match any real NetApp cabling guide, and misclassified A900/C800 into the wrong scheme entirely (`"A900".includes("A90")` and `"C800".includes("C80")` matched the wrong branch). Replaced with the real, sourced port names per platform family (see `DATA_SOURCES.md`) -- confirmed AFF and ASA/ASA r2 share identical physical ports for the same chassis via direct fetches of `docs.netapp.com`'s AFF and ASA r2 install-cable guides.
- **Cabling Diagram Silently Dropped HA Pairs**: The storage-shelf cabling table/diagram looped over shelves (not HA pairs) to assign shelf connections -- on any cluster where the configured disk count produced fewer shelves than HA pairs (e.g. the default 24-disk/1-shelf config with 4+ nodes), pairs beyond the first were completely missing from the cabling output, in both the standard and MetroCluster generators. Now loops over pairs so every pair gets at least one (possibly shared) shelf connection.
- **Fabricated ASA r2 SAN CLI Commands**: The ASA r2 iSCSI/FC/NVMe branches generated a nonexistent `storage-unit subsystem create` / `storage-unit create` command family. Confirmed against NetApp's official ASA r2 CLI support page that `igroup create`, `lun create`, `lun map`, and `vserver nvme subsystem`/`namespace` commands are unchanged on ASA r2 (only `volume create` and `storage aggregate create` are unsupported there); replaced accordingly.
- **Wrong `security login` CLI Parameters**: `security login role create` used `-command` instead of the real `-cmddirname`; the JIT privilege-elevation step used a nonexistent `security login modify -privilege-elevation` flag instead of the real `security jit-privilege user create` command (ONTAP 9.17.1+).
- **LIF Home-Ports Didn't Match the Selected Controller**: Ethernet-based LIF creation (NFS/SMB/iSCSI/NVMe-TCP/S3) always used generic `e0a`-`e0f` home-ports regardless of the selected controller, so the CLI script's ports could disagree with the cabling diagram's ports for the same platform. Now sourced from the same `getControllerPorts()` catalog as the cabling diagram.
- **Wrong Ansible `na_ontap_volume` Parameters**: Used `aggregate` (real parameter name is `aggregate_name`) and a nonexistent `inline_deduplication` parameter; corrected/removed respectively.
- **Duplicate CLI Section Header**: The "PROTOCOL INTERFACES & EXPORTS" header was printed twice in a row in the generated CLI output.

## [1.5.0] - 2026-07-15

### Added
- **StorageGRID 12.1 Software Support**: Integrated the latest StorageGRID software release featuring global namespace scaling and increased throughput.
- **Next-Gen StorageGRID Appliance Models**: Added SGF6212 (All-Flash), SG6260 (high-performance 60-bay hybrid), SG120, and SG1200 compute gateway services appliances.
- **Next-Gen ONTAP FAS Controllers**: Integrated FAS70 and FAS90 hybrid storage controller models with advanced high-capacity networking.
- **Ultra-High Capacity SSD Support**: Added support for 61.4TB QLC NVMe SSDs in NVMe disk shelves, plus 15.3TB/30.6TB SSD sizes for high-density StorageGRID flash models.
- **Robust Version Capabilities Checks**: Shifted version-dependent feature gates (e.g. S3 Caching, Bucket Branches) to checking compatibility patterns matching `.startsWith("12.")` or later, instead of hardcoded `12.0` string matches.
- **Automatic Offline Compiler Version Alignment**: Bumped compilation build profile to version 1.5.0 (Build 5).

## [1.4.1] - 2026-07-06

### Added
- **Legal License & Indemnification Terms**: Created a LICENSE file in the repository root detailing MIT license terms, plus a strong liability disclaimer.
- **UI Disclaimer Card**: Added a red warning card in the final Review & Generate wizard step containing explicit legal disclaimers.
- **In-Zip License Bundle**: Bundled `LICENSE.txt` automatically inside generated output design ZIP archives.
- **Documentation Disclaimers**: Appended legal disclaimer notes to README.md.

## [1.4.0] - 2026-07-05

### Removed
- **AutoSupport Parser & Dependencies**: Removed the local WASM decompressors `sevenzip_wasm.wasm`, `sevenzip_js.js`, and `asup_examples.js`.
- **Pako Dependency**: Removed `pako.js` library from compiler script and index layout.

### Fixed
- **StorageGRID Dropdown Bug**: Fixed issues where ONTAP's `9.19.1` and `A150` options would remain selected or stuck when toggling to StorageGRID.
- **FAS Platform Labels**: Cleaned up `/ AFX` labels from FAS options and logs.

## [1.3.0] - 2026-07-05

### Added
- **Dynamic Repository Downloader**: Added a "Download Source" button in the application header that compiles all project files into a ZIP archive on-the-fly using `JSZip` directly in the browser.
- **Local File Security Alerts**: Added smart detection for the `file://` protocol. If run from the compiled offline bundle, it detects the local context and alerts the user to download from the GitHub repository instead of triggering CORS-blocked fetches.

### Changed
- **Git Remote Alignment**: Updated the default remote configuration to point to the active repository: `https://github.com/ebeauzec/NetApp.git`.
- **Version Updates**: Bumped the application version from `1.2.0` to `1.3.0` (build version `2`) in the configuration headers (`app.js`), UI layout (`index.html`), and macOS application settings (`Info.plist`).

---

## [1.2.0] - 2026-06-26

### Added
- **WASM Extraction**: Decoupled the 7-Zip decompression components (`sevenzip_js.js` and `sevenzip_wasm.wasm`) and moved them to the workspace root.
- **Automated Bundle Compiler**: Created `bundle_offline.py` to inline all JS, CSS, and WebAssembly dependencies into a standalone single-file app `NetAppConfigurator_Offline.html`.

### Fixed
- **Google Drive VFS Locks**: Resolved `OSError: [Errno 22]` lock issues under Windows Google Drive by keeping WASM files in the root folder instead of the locked `scratch/` directory.
- **Codebase Restoration**: Successfully reconstructed code modules (`app.js`, `index.html`, `style.css`, `asup_examples.js`) from corrupt files.
