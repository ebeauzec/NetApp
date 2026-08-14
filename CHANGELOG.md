# Changelog

All notable changes to the NetApp Solutions Architect Configurator will be documented in this file.

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
