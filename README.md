# NetApp Configurator

A web-based interactive tool for configuring NetApp storage controllers, analyzing ASUP configurations, and checking compatibility.

## Features

- **Interactive Configuration**: View, select, and configure NetApp controllers, chassis, shelves, and disk configurations.
- **ASUP Parsing & Analysis**: Upload and analyze ASUP logs or configuration data to generate hardware configurations automatically.
- **Offline Compatibility**: Packaged to run completely offline as a standalone single-file HTML app.

## How to Run

### Development Version (Modular)
Simply open `index.html` in your web browser, or host it locally:
```bash
# Serve the directory locally
python -m http.server 8000
```
Then open `http://localhost:8000` in your browser.

### Standalone Offline Version
You can compile the entire application, including the embedded 7-Zip WASM decompressor, into a single offline HTML file:
```bash
python bundle_offline.py
```
This generates `NetAppConfigurator_Offline.html`, which can be opened directly from the filesystem on any machine without internet access or web server hosting.

## Deployment to GitHub Pages

This repository is configured for deployment to GitHub Pages.
To publish:
1. Go to the repository settings on GitHub.
2. Select **Pages** from the sidebar.
3. Under **Build and deployment**, set the source to **Deploy from a branch**.
4. Choose the `main` branch and the `/ (root)` folder, then click **Save**.
