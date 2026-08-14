# NetApp Solutions Architect Configurator & Code Generator

A premium, interactive web-based configurator designed for NetApp solutions architects. It allows you to model ONTAP storage controllers, configure StorageGRID environments, and generate deployment code.

The application is built entirely as a client-side front-end app (HTML, CSS, and JS) with no server-side backend required.

---

## 🚀 What's New in v1.6.0

*   **"Check for Updates" Button**: Checks whether `ONTAP_VERSIONS` / `STORAGEGRID_VERSIONS` are still current against live sources (endoflife.date, docs.netapp.com). Talks only to a local helper you start yourself -- the app never reaches the internet on its own. See [Checking for Updates](#-checking-for-updates) below.
*   **One-Step Launcher**: `launch.py` / `launch.bat` starts that helper and opens the app in one step; `NetAppConfigurator.bat` now does the same automatically.
*   **Sourced Controller Port Catalog**: Cabling diagrams and CLI `-home-port` values now use each platform's real cluster/HA, storage, and host-data ports (sourced from `docs.netapp.com` install-cable guides), replacing generic placeholder port names used for most platforms previously. See `DATA_SOURCES.md`.
*   **CLI Generator Corrections**: Fixed fabricated ASA r2 SAN commands (`storage-unit ...` doesn't exist in ONTAP; real `igroup`/`lun`/`vserver nvme` commands used instead), wrong `security login`/JIT-elevation parameters, and a cabling-diagram bug that silently dropped HA pairs on clusters with fewer shelves than pairs.
*   **Bug Fixes**: Fixed a crash on the Step 1 example-data buttons, a capacity-calculator display bug where Spare + Parity could exceed Total Raw, a broken "Download Source" repository link, and incorrect Ansible module parameters. See `CHANGELOG.md`.

---

## 🚀 What's New in v1.5.0

*   **StorageGRID 12.1 Software**: Added support for version 12.1 featuring global federated namespace configurations.
*   **Next-Gen Hardware Models**: 
    *   **ONTAP**: Added **FAS70** and **FAS90** hybrid-flash controller configurations.
    *   **StorageGRID**: Added **SGF6212** (All-Flash Storage node), **SG6260** (60-Bay High-Density node), **SG120**, and **SG1200** (Compute services/admin load-balancer nodes).
*   **High-Capacity SSDs**: Added support for **61.4TB** QLC NVMe SSDs for ultra-dense performance arrays, and **15.3TB** / **30.6TB** SSDs for StorageGRID capacity flash configurations.
*   **Dynamic Capabilities Mapping**: Updated version-specific feature gates to automatically scale across future ONTAP and StorageGRID 12.x releases.
*   **Indemnification Disclaimer**: Prominently displays the legal disclaimers and ownership terms inside the summary review step and the generated deliverable ZIP packages.

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

## 🔄 Checking for Updates

The app itself never reaches the internet on its own -- that's the whole point of the zero-dependency, offline-first design above. The header's **"Check for Updates"** button instead talks to a small local helper script.

**Easiest: start the app via the launcher instead of opening the HTML file directly.**

-   Windows: double-click **`NetAppConfigurator.bat`** (updated in v1.6.0 to also start the helper) or **`launch.bat`**
-   Any OS: `python launch.py`

This starts the local helper (`tools/update_server.py`) in the background and opens `NetAppConfigurator_Offline.html` for you -- "Check for Updates" just works, no manual terminal step. Close the helper's console window whenever you want the app back to fully offline.

**Manual alternative**, if you'd rather keep opening the HTML file directly:

1. Open a terminal in this directory and run:
    ```bash
    python tools/update_server.py
    ```
    This starts a local server on `http://127.0.0.1:8766` -- it fetches endoflife.date's ONTAP lifecycle API and docs.netapp.com's StorageGRID docs page itself, and only ever talks back to the app over localhost.
2. Click **Check for Updates** in the app. It reports whether `ONTAP_VERSIONS` / `STORAGEGRID_VERSIONS` in `app.js` still match the latest publicly released versions -- it does **not** silently rewrite any source file.
3. If drift is reported, update `app.js` by hand per `DATA_SOURCES.md`'s Update Procedure, then run `python bundle_offline.py` to rebuild the offline file.
4. Close the terminal running `update_server.py` when you're done -- the app goes back to being fully offline.

Why a local helper at all, instead of the app fetching directly? `docs.netapp.com` sends no `Access-Control-Allow-Origin` header, so a browser blocks the app's JS from reading the response even though the request itself would go through -- this is a real, verified constraint, not a design choice. The helper has a normal Python network stack and serves its result back over localhost with CORS headers it controls. See `DATA_SOURCES.md` for exactly what is and isn't checked.

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
├── tools/
│   ├── harvest_reference_data.py  # Fetches endoflife.date + docs.netapp.com for Check for Updates
│   ├── apply_reference_data.py    # Compares harvested data against app.js, reports drift
│   └── update_server.py           # Local-only (127.0.0.1:8766) HTTP server backing the button
├── data/netapp_docs_raw/        # Harvested raw source pages (gitignored, regenerated on demand)
├── launch.py                    # One-step launcher: starts the update helper + opens the app
├── launch.bat                   # Windows shortcut for launch.py
├── DATA_SOURCES.md              # What Check for Updates checks, what it doesn't, and why
├── README.md                    # Core project documentation
├── CHANGELOG.md                 # Change records
├── Info.plist                   # Apple plist metadata for macOS bundle
├── main.swift                   # Swift wrapper source for macOS native app
├── build_app.sh                 # macOS compilation shell script
└── NetAppConfigurator.bat       # Windows launch script (also starts the update helper)
```

---

## 🌐 Deployment to GitHub Pages

This repository is optimized to deploy directly to GitHub Pages.
1.  Go to your repository settings page: `https://github.com/ebeauzec/NetApp/settings/pages`.
2.  Under **Build and deployment**, set the source to **Deploy from a branch**.
3.  Choose the **`main`** branch and the **`/ (root)`** folder.
4.  Click **Save**.
5.  Your page will be live at `https://ebeauzec.github.io/NetApp/`.


---

## ⚖️ License, Intellectual Property & Legal Disclaimer

This project is licensed under the MIT License and the intellectual property terms below. See the [LICENSE](LICENSE) file for the full text.

## Ownership, Intellectual Property Rights and Independent Development

This software application, including without limitation its source code, object code, documentation, technical specifications, architecture, designs, workflows, configurations, prompts, scripts, build materials, databases, user interfaces, and all related materials, content and developments, whether existing now or created in the future, is the sole and exclusive intellectual property of *Eugene Beauzec*.

All rights, title and interest in and to the software, including all copyright, economic rights, moral rights to the extent applicable, neighbouring rights, database rights, know-how, trade secrets, inventions, improvements, derivative works, updates, enhancements and all other intellectual property rights, are and shall remain exclusively vested in *Eugene Beauzec*, unless expressly transferred by him under a separate written agreement signed by him.

The software was independently conceived, authored, developed, tested and assembled by *Eugene Beauzec* on his own time and using independent tools, resources and development environments. The software was not created as a work-for-hire, commissioned work, employment deliverable, client assignment, internal project, sponsored project, or contractual obligation for any employer, former employer, client, sponsor, platform provider, user, contributor or third party.

No employer, former employer, client, sponsor, platform provider, user, contributor or third party shall acquire any ownership interest, licence, royalty, profit-share, assignment right, benefit, claim, control, or other right in or to the software by reason of Eugene Beauzec’s past or present employment, sponsorship, administrative status, visa status, immigration status, professional relationship, access to the software, use of the software, feedback, contribution, or use of independent development tools.

The software does not contain, incorporate, derive from, or rely upon any confidential information, proprietary material, customer data, trade secrets, private repositories, internal systems, credentials, unpublished documentation, business plans, source code, technical materials, employer-provided resources, or non-public information belonging to any employer, former employer, client, sponsor, platform provider, user, contributor or third party.

Any use of third-party tools, including generative-AI assisted development tools, was carried out solely as an independent development aid under Eugene Beauzec’s personal direction, review, testing, selection and control. No confidential, proprietary, customer, internal, employer-owned, client-owned, or trade-secret information of any employer, former employer, client, sponsor, platform provider, user, contributor or third party was submitted to, uploaded into, disclosed to, or used with such tools in connection with the development of the software.

All rights not expressly granted in writing by Eugene Beauzec are strictly reserved. No person or entity may copy, reproduce, modify, adapt, translate, publish, distribute, commercialise, sublicense, sell, assign, transfer, pledge, reverse engineer, remove attribution from, or claim authorship or ownership of the software, in whole or in part, except as expressly authorised in writing by Eugene Beauzec.

Any permitted use of the software is subject to the licence terms expressly stated by Eugene Beauzec. Nothing in this notice shall be interpreted as granting any implied licence, ownership right, commercial right, assignment, waiver, consent, or permission beyond what is expressly granted in writing.

If any third-party proprietary material is credibly identified as having been inadvertently included in the software, Eugene Beauzec reserves the right to remove, replace or remediate such material promptly, without admission of liability and without prejudice to his ownership of the remaining software.

Any references to third-party products, services, companies, platforms, trademarks, technologies or tools are made solely for identification, compatibility, interoperability, technical, or documentation purposes. Such references do not imply any affiliation, sponsorship, endorsement, approval, authorisation, partnership, licence, or commercial relationship with the relevant third-party owner. All third-party trademarks, product names, company names and service names remain the property of their respective owners.

Copyright © 2026 Eugene Beauzec. All Rights Reserved.

---

> [!CAUTION]
> **LEGAL DISCLAIMER & INDEMNIFICATION:**
> This tool is an independent simulator and is not affiliated with NetApp. All configurations, command scripts, and topologies are provided **"AS IS"** for simulation and educational purposes only.
> 
> In no event shall the author (**Eugene Beauzec**) or repository owner be liable for any direct, indirect, incidental, special, or consequential damages (including, but not limited to, configuration errors, hardware damage, data loss, downtime, or business interruption) arising out of the use or inability to use this software. The user assumes 100% of the risk and is solely responsible for verifying configurations against official manufacturer documentation before deploying them to any storage systems.
