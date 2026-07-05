import urllib.request
import re
import os

print("=== STARTING OFFLINE SINGLE-FILE HTML BUNDLE COMPILATION ===")

# Define CDN assets to download and inline
CDNS = {
    "prism_css": {
        "url": "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css",
        "placeholder": '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css">',
        "type": "style"
    },
    "jszip_js": {
        "url": "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
        "placeholder": '<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>',
        "type": "script"
    },

    "prism_js": {
        "url": "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js",
        "placeholder": '<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>',
        "type": "script"
    },
    "prism_yaml_js": {
        "url": "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-yaml.min.js",
        "placeholder": '<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-yaml.min.js"></script>',
        "type": "script"
    },
    "prism_bash_js": {
        "url": "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-bash.min.js",
        "placeholder": '<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-bash.min.js"></script>',
        "type": "script"
    },
    "prism_json_js": {
        "url": "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-json.min.js",
        "placeholder": '<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-json.min.js"></script>',
        "type": "script"
    },
    "lucide_js": {
        "url": "https://unpkg.com/lucide@latest",
        "placeholder": '<script src="https://unpkg.com/lucide@latest"></script>',
        "type": "script"
    }
}

base_dir = os.path.dirname(os.path.abspath(__file__))

# 1. Read index.html
with open(os.path.join(base_dir, "index.html"), "r", encoding="utf-8") as f:
    html = f.read()

# 2. Download and Inline CDN assets
for name, info in CDNS.items():
    print(f"Downloading CDN asset: {name} from {info['url']}...")
    try:
        req = urllib.request.Request(
            info["url"], 
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        )
        with urllib.request.urlopen(req) as response:
            content = response.read().decode("utf-8")
        
        if info["type"] == "style":
            replacement = f"<style>\n{content}\n</style>"
        else:
            replacement = f"<script>\n{content}\n</script>"
            
        html = html.replace(info["placeholder"], replacement)
        print(f"Successfully inlined: {name}")
    except Exception as e:
        print(f"ERROR: Failed to download {name} ({e})")
        exit(1)

# 3. Inline local stylesheets
print("Inlining local style.css...")
with open(os.path.join(base_dir, "style.css"), "r", encoding="utf-8") as f:
    style_css = f.read()
html = html.replace('<link rel="stylesheet" href="style.css">', f"<style>\n{style_css}\n</style>")
# 4. Inline local JS scripts

print("Inlining local app.js...")
with open(os.path.join(base_dir, "app.js"), "r", encoding="utf-8") as f:
    app_js = f.read()
html = html.replace('<script src="app.js"></script>', f"<script>\n{app_js}\n</script>")

# 5. Output compiled HTML file
output_file = os.path.join(base_dir, "NetAppConfigurator_Offline.html")
with open(output_file, "w", encoding="utf-8") as f:
    f.write(html)

print(f"SUCCESS: Compiled single-file offline HTML bundle at {output_file}!")
print("=== COMPILATION COMPLETE ===")
