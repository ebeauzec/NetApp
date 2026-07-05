# NetApp Solutions Architect Configurator & Code Generator

A premium, interactive web-based configurator designed for NetApp solutions architects. It allows you to model ONTAP storage controllers, configure StorageGrid environments, parse AutoSupport (ASUP) logs to import architectures automatically, and generate deployment code.

The application is built entirely as a client-side front-end app (HTML, CSS, JS, and WebAssembly) with no server-side backend required.

---

## 🚀 What's New in v1.3.0

*   **Dynamic Source Downloader**: A new **Download Source** button is integrated into the header actions. It fetches all active codebase files relative to the host, packages them into a `.zip` archive on-the-fly via `JSZip`, and downloads it to your computer.
*   **Security Handling for `file://`**: Added smart checks for pages running on the local filesystem (`file://`). If run in offline mode, it catches blocked fetches and displays instructions for downloading from GitHub.
*   **StorageGrid Updates**: Merged documentation updates incorporating StorageGrid configurations directly into the layout.

---

## 🛠 How to Run

Because the application uses modern JavaScript modules (ES6) and WebAssembly (for client-side 7-Zip extraction of ASUP bundles), you have two distinct ways to run it:

### Option A: Modular Development Version (Local HTTP Server)
Recommended for development and editing. Browsers restrict WebAssembly and ES6 modules over the `file://` protocol due to CORS security rules. To bypass this, run a lightweight HTTP server in the repository folder:

*   **Python (Pre-installed on most systems)**:
    ```bash
    python -m http.server 8000
    ```
*   **NodeJS (`http-server`)**:
    ```bash
    npx http-server -p 8000
    ```
Once running, open your browser and navigate to **`http://localhost:8000`**.

### Option B: Standalone Offline Version (`NetAppConfigurator_Offline.html`)
Recommended for offline use, customer sites, or secure environments. You can compile the entire modular application—including all styles, scripts, and the 7-Zip WebAssembly binary—into a single offline HTML document.

1.  Compile the offline bundle by running:
    ```bash
    python bundle_offline.py
    ```
2.  Once compiled, open the generated **`NetAppConfigurator_Offline.html`** file:
    *   **Windows**: Double-click `NetAppConfigurator.bat` or the `.html` file.
    *   **macOS**: Double-click the compiled native wrapper `NetAppConfigurator.app` (which embeds the bundle in a native WKWebView).

---

## 📋 Features & Usage Guide

### 1. Multi-Step Wizard Configuration
Move through the left navigation pane to configure:
*   **Platform & Version**: Model ONTAP or StorageGrid deployment versions.
*   **Access Protocols**: Configure NFS, CIFS/SMB, iSCSI, FC, FCoE, and NVMe endpoints.
*   **Chassis & Controller**: Select chassis types, disk shelves, and high-availability controller pairings.
*   **Disks & Aggregates**: Model RAID types, spare drives, data aggregates, and volume sizing.
*   **Network & Ports**: Define MTU settings, interface groups, VLANs, and port speeds.
*   **Tenant & Integrations**: Set up FabricPool targets, S3 load balancer configurations, and identity federation.
*   **Summary & Code Preview**: Generate ready-to-run automation code (CLI commands, Ansible playbooks) based on your wizard settings.

### 2. AutoSupport (ASUP) Bundle Parser
Import existing architectures in seconds:
*   Drag and drop a `.txt` log or compressed `.7z` / `.zip` AutoSupport bundle into the parser card.
*   The integrated browser-based WebAssembly decompressor extracts the files locally and auto-fills configurations.

### 3. Save & Load Config States
*   **Save Config**: Downloads your current wizard selections into a portable `.json` configuration file.
*   **Import Config**: Upload a saved `.json` file to restore your configuration state.

---

## 📂 Project Structure

```
NetApp/
├── index.html                   # HTML entry point (Modular)
├── style.css                    # Design styles (CSS variables, dark mode)
├── app.js                       # Configurator logic, wizard controller & parsing
├── asup_examples.js             # Mock AutoSupport sample structures
├── sevenzip_js.js               # WebAssembly JS wrapper for 7-zip
├── sevenzip_wasm.wasm           # 7-Zip WebAssembly binary
├── bundle_offline.py            # Python packager script to compile the offline app
├── README.md                    # Core project documentation
├── CHANGELOG.md                 # Change records
├── Info.plist                   # Apple plist metadata for macOS bundle
├── main.swift                   # Swift wrapper source for macOS native app
├── build_app.sh                 # macOS compilation shell script
└── NetAppConfigurator.bat       # Windows launch script
```

---

## 🌐 Deployment to GitHub Pages

This repository is optimized to deploy directly to GitHub Pages.
1.  Go to your repository settings page: `https://github.com/ebeauzec/NetApp/settings/pages`.
2.  Under **Build and deployment**, set the source to **Deploy from a branch**.
3.  Choose the **`main`** branch and the **`/ (root)`** folder.
4.  Click **Save**.
5.  Your page will be live at `https://ebeauzec.github.io/NetApp/`.
