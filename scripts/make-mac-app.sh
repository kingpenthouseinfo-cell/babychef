#!/bin/bash
# Makes "Baby Chef Studio.app" in ~/Applications that starts the app in the background and opens it in your browser.
# Run once from the app folder:  npm run make-app   (then drag the app to your Dock if you like)
set -e
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$HOME/Applications}/Baby Chef Studio.app"
mkdir -p "$OUT/Contents/MacOS"
cat > "$OUT/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>Baby Chef Studio</string>
<key>CFBundleDisplayName</key><string>Baby Chef Studio</string>
<key>CFBundleIdentifier</key><string>local.babychefstudio</string>
<key>CFBundleExecutable</key><string>BabyChefStudio</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleVersion</key><string>1</string>
</dict></plist>
PLIST
cat > "$OUT/Contents/MacOS/BabyChefStudio" <<LAUNCH
#!/bin/bash
APP_DIR="$APP_DIR"
LOG="\$HOME/Library/Logs/BabyChefStudio.log"
mkdir -p "\$HOME/Library/Logs"
if ! /usr/sbin/lsof -ti:3000 >/dev/null 2>&1; then
  /bin/zsh -lc "cd '\$APP_DIR' && npm start" >> "\$LOG" 2>&1 &
  for i in \$(seq 1 300); do /usr/bin/curl -s -o /dev/null http://localhost:3000 && break; sleep 1; done
fi
if /usr/bin/curl -s -o /dev/null http://localhost:3000; then /usr/bin/open http://localhost:3000; else /usr/bin/osascript -e 'display dialog "Baby Chef Studio did not start. The log will open so you can send it to me." buttons {"OK"}' >/dev/null 2>&1; /usr/bin/open -a TextEdit "\$LOG"; fi
LAUNCH
chmod +x "$OUT/Contents/MacOS/BabyChefStudio"
echo "Made: $OUT"
echo "Double-click it to start Baby Chef Studio (it opens in your browser). To stop it use Settings > Quit in the app."
