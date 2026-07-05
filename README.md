# NetApp Solutions Architect Configurator & Code Generator

A premium, interactive web-based configurator designed for NetApp solutions architects. It allows you to model ONTAP storage controllers, configure StorageGRID environments, and generate deployment code.

The application is built entirely as a client-side front-end app (HTML, CSS, and JS) with no server-side backend required.

---

## 🚀 What's New in v1.4.0

*   **AutoSupport Cleanup**: Completely removed the heavy, unmaintained AutoSupport log parser and its decompressors (`sevenzip_wasm.wasm`, `sevenzip_js.js`, and `pako.js`). This optimizes load times and reduces bundle footprint.
*   **Platform Selection Dropdown Fixes**: Fixed version/controller context synchronization bugs so that toggling between ONTAP and StorageGRID immediately resets dropdown selections to valid target defaults.
*   **FAS Naming Cleanup**: Removed incorrect `/ AFX` labels from FAS options and warning dialogs.
*   **Dynamic Source Downloader**: A **Download Source** button is integrated into the header actions. It packages all active codebase files into a `.zip` archive on-the-fly via `JSZip` directly in the browser.
*   **Security Handling for `file://`**: Added checks for pages running on the local filesystem (`file://`) to catch blocked fetches and display local download instructions.

---

## 🛠 How to Run (Preferred Zero-Dependency Method)

The configurator is designed to be **completely portable and self-contained with zero dependencies**. You do not need to install node modules, configure web servers, run command lines, or compile anything to use it. 

### 🚀 Recommended: Run Standalone Offline
Simply double-click the **`NetAppConfigurator_Offline.html`** file in your browser:
*   **Direct Web Browser**: Open `NetAppConfigurator_Offline.html` directly in Chrome, Edge, Safari, Firefox, or Brave.
*   **Windows Shortcut**: Double-click `NetAppConfigurator.bat` to launch it immediately in Microsoft Edge.
*   **macOS Wrapper**: Double-click the compiled native wrapper `NetAppConfigurator.app` (which launches the offline app inside a native Cocoa/WebKit window).

*Everything required to run the configurator (including styles, layout, and configuration databases) is entirely self-contained within this single offline HTML file.*

---

## 💻 Alternative: Running Modular Files (For Development Only)

If you are modifying the source code and want to test changes dynamically without rebuilding the offline file every time:

### 1. Run a Local HTTP Server
Browsers enforce security (CORS) restrictions over the `file://` protocol when loading separate ES6 JavaScript modules locally. To bypass this during development, run a lightweight server:
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

## 📂 Project Structure

```
NetApp/
├── index.html                   # HTML entry point (Modular)
├── style.css                    # Design styles (CSS variables, dark mode)
├── app.js                       # Configurator logic and wizard controller
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
