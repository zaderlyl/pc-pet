#!/bin/bash
# Construit « PC Pet Hub.app » — une fenêtre autonome avec la galerie des emotes.
# Double-cliquer ce fichier (ou : bash build-hub.command) pour (re)construire.
set -e
cd "$(dirname "$0")"

SRC="node_modules/electron/dist/Electron.app"
APP="PC Pet Hub.app"
PB=/usr/libexec/PlistBuddy

[ -d "$SRC" ] || { echo "Electron introuvable — lance 'npm install' d'abord."; exit 1; }

echo "• copie d'Electron…"
rm -rf "$APP"
cp -R "$SRC" "$APP"

echo "• injection du hub…"
RES="$APP/Contents/Resources/app"
mkdir -p "$RES/renderer"
cp hub/main.js hub/package.json "$RES/"
cp gallery.html "$RES/gallery.html"
cp renderer/engine.js "$RES/renderer/engine.js"

echo "• Info.plist…"
mv "$APP/Contents/MacOS/Electron" "$APP/Contents/MacOS/PC Pet Hub"
PL="$APP/Contents/Info.plist"
$PB -c "Set :CFBundleExecutable 'PC Pet Hub'" "$PL"
$PB -c "Set :CFBundleName 'PC Pet Hub'" "$PL"
$PB -c "Set :CFBundleDisplayName 'PC Pet Hub'" "$PL" 2>/dev/null || $PB -c "Add :CFBundleDisplayName string 'PC Pet Hub'" "$PL"
$PB -c "Set :CFBundleIdentifier 'com.lilian.pcpethub'" "$PL"
$PB -c "Set :CFBundleName 'PC Pet Hub'" "$PL"

if [ -f hub/icon.icns ]; then
  echo "• icône…"
  cp hub/icon.icns "$APP/Contents/Resources/electron.icns"
  $PB -c "Set :CFBundleIconFile 'electron'" "$PL" 2>/dev/null || true
fi

echo "• signature ad-hoc…"
codesign --remove-signature "$APP" 2>/dev/null || true
codesign --force --deep --sign - "$APP" 2>/dev/null || echo "  (codesign a échoué — au 1er lancement : clic droit ▸ Ouvrir)"

xattr -dr com.apple.quarantine "$APP" 2>/dev/null || true
echo ""
echo "✓ « $APP » prêt.  Glisse-le dans /Applications ou le Dock si tu veux."
