# NetApp Solutions Architect Configurator & Code Generator

A premium, interactive web-based configurator designed for NetApp solutions architects. It allows you to model ONTAP storage controllers, configure StorageGrid environments, parse AutoSupport (ASUP) logs to import architectures automatically, and generate deployment code.

The application is built entirely as a client-side front-end app (HTML, CSS, JS, and WebAssembly) with no server-side backend required.

---

## 🚀 What's New in v1.3.0

*   **Dynamic Source Downloader**: A new **Download Source** button is integrated into the header actions. It fetches all active codebase files relative to the host, packages them into a `.zip` archive on-the-fly via `JSZip`, and downloads it to your computer.
*   **Security Handling for `file://`**: Added smart checks for pages running on the local filesystem (`file://`). If run in offline mode, it catches blocked fetches and displays instructions for downloading from GitHub.
*   **StorageGrid Updates**: Merged documentation updates incorporating StorageGrid configurations directly into the layout.

---

## 🛠 How to Run (Preferred Zero-Dependency Method)

The configurator is designed to be **completely portable and self-contained with zero dependencies**. You do not need to install node modules, configure web servers, run command lines, or compile anything to use it. 

### 🚀 Recommended: Run Standalone Offline
Simply double-click the **`NetAppConfigurator_Offline.html`** file in your browser:
*   **Direct Web Browser**: Open `NetAppConfigurator_Offline.html` directly in Chrome, Edge, Safari, Firefox, or Brave.
*   **Windows Shortcut**: Double-click `NetAppConfigurator.bat` to launch it immediately in Microsoft Edge.
*   **macOS Wrapper**: Double-click the compiled native wrapper `NetAppConfigurator.app` (which launches the offline app inside a native Cocoa/WebKit window).

*Everything required to run the configurator (including styles, configuration databases, and the 7-Zip parser WebAssembly engine) is entirely self-contained within this single offline HTML file.*

---

## 💻 Alternative: Running Modular Files (For Development Only)

If you are modifying the source code and want to test changes dynamically without rebuilding the offline file every time:

### 1. Run a Local HTTP Server
Browsers enforce security (CORS) restrictions over the `file://` protocol when loading separate ES6 JavaScript modules or WebAssembly files locally. To bypass this during development, run a lightweight server:
*   **Python**:
    ```bash
    python -m http.server 8000
    ```
*   **NodeJS**:
    ```bash
    npx http-server -p 8000
    ```
Once running, navigate to `http://localhost:8000`.

### 2. Compile Changes to the Offline App
After testing and finalizing your code modifications in the modular files (`app.js`, `index.html`, `style.css`), compile them back into the self-contained offline bundle by running:
```bash
python bundle_offline.py
```

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
