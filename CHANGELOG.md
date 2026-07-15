# Changelog

All notable changes to the NetApp Solutions Architect Configurator will be documented in this file.

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
