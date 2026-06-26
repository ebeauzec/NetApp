#!/bin/bash
set -e

echo "=== STARTING NATIVE MACOS BUNDLE COMPILATION ==="

# 0. Compile offline single-file HTML bundle first
echo "Compiling offline HTML bundle..."
python3 bundle_offline.py

APP_NAME="NetAppConfigurator.app"
BINARY_NAME="NetAppConfigurator"

# 1. Clean previous builds
echo "Cleaning up old build folders..."
rm -rf "$APP_NAME"
rm -f "${BINARY_NAME}.zip"

# 2. Build folder structure
echo "Creating bundle directory hierarchy..."
mkdir -p "$APP_NAME/Contents/MacOS"
mkdir -p "$APP_NAME/Contents/Resources"

# 3. Compile Swift wrapper
echo "Compiling Swift wrapper binary..."
swiftc -O -o "$APP_NAME/Contents/MacOS/$BINARY_NAME" main.swift -framework Cocoa -framework WebKit

# 4. Copy metadata Info.plist
echo "Copying application configuration Plist..."
cp Info.plist "$APP_NAME/Contents/Info.plist"

# 5. Copy Web frontend assets to resources path
echo "Copying web asset resources..."
cp NetAppConfigurator_Offline.html "$APP_NAME/Contents/Resources/index.html"


# 6. Verify packaging structure
echo "Verifying bundle structure..."
if [ ! -f "$APP_NAME/Contents/MacOS/$BINARY_NAME" ]; then
    echo "ERROR: Executable binary is missing!"
    exit 1
fi
if [ ! -f "$APP_NAME/Contents/Info.plist" ]; then
    echo "ERROR: Info.plist is missing!"
    exit 1
fi
if [ ! -f "$APP_NAME/Contents/Resources/index.html" ]; then
    echo "ERROR: index.html resource is missing!"
    exit 1
fi

echo "SUCCESS: $APP_NAME compiled and packaged successfully!"

# 7. Create distributable ZIP archive
echo "Creating distributable ZIP package..."
zip -q -r "${BINARY_NAME}.zip" "$APP_NAME"

# 8. Copy to User's Downloads directory
echo "Copying distributable bundles to /Users/eugenebeauzec/Downloads/..."
rm -rf /Users/eugenebeauzec/Downloads/NetAppConfigurator.app
cp -R NetAppConfigurator.app /Users/eugenebeauzec/Downloads/
cp NetAppConfigurator_Offline.html /Users/eugenebeauzec/Downloads/
cp NetAppConfigurator.zip /Users/eugenebeauzec/Downloads/
echo "Successfully copied bundles to Downloads."

echo "=== COMPILATION & DISTRIBUTABLE ZIP CREATION COMPLETE ==="
echo "Artifact created: ${BINARY_NAME}.zip"
