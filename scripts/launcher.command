#!/bin/bash
# Baby Chef Studio — one double-click to START, and to UPDATE when a newer zip is in your Downloads folder.
# Your pictures, videos and saved projects live in ~/Documents/Baby Chef Studio and are never touched.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
APP="$HOME/baby-chef-studio"
STAMP="$APP/.installed-from"
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
pause() { echo; read -r -p "Press Return to close this window." _; exit 1; }
cd "$HOME" || exit 1
if ! command -v node >/dev/null 2>&1; then
  say "Baby Chef Studio needs Node.js (one-time install)."
  echo "Opening nodejs.org — download the LTS version, install it, then double-click this file again."
  command -v open >/dev/null && open "https://nodejs.org/"
  pause
fi
ZIP="$(ls -t "$HOME"/Downloads/baby-chef-studio*.zip 2>/dev/null | head -1)"
# stop a copy that is already running
PIDS="$(lsof -ti:3000 2>/dev/null)"; [ -n "$PIDS" ] && kill $PIDS 2>/dev/null && sleep 2

if [ -n "$ZIP" ] && { [ ! -d "$APP" ] || [ "$ZIP" -nt "$STAMP" ]; }; then
  say "Updating from $(basename "$ZIP") …"
  TMP="$(mktemp -d)"
  unzip -q "$ZIP" -d "$TMP" || { echo "That zip could not be opened."; pause; }
  [ -d "$TMP/baby-chef-studio" ] || { echo "That zip does not look like Baby Chef Studio."; pause; }
  BACKUP=""
  if [ -d "$APP" ]; then BACKUP="$APP-OLD-$(date +%Y%m%d-%H%M%S)"; mv "$APP" "$BACKUP"; fi
  mv "$TMP/baby-chef-studio" "$APP"
  cd "$APP" || exit 1
  cp .env.example .env
  if npm install && npx prisma generate; then
    touch "$STAMP"
    cp -f "$APP/scripts/launcher.command" "$HOME/Desktop/Baby Chef Studio.command" 2>/dev/null && chmod +x "$HOME/Desktop/Baby Chef Studio.command"
  else
    echo; echo "The update did not finish. Putting your old version back."
    cd "$HOME"; rm -rf "$APP"; [ -n "$BACKUP" ] && mv "$BACKUP" "$APP"
    pause
  fi
elif [ ! -d "$APP" ]; then
  say "Baby Chef Studio is not installed yet."
  echo "Download the zip from Claude (it lands in Downloads), then double-click this file again."
  pause
fi

cd "$APP" || exit 1
say "Starting Baby Chef Studio … (the first start after an update takes a few minutes)"
echo "Your browser opens by itself when it is ready. Close this window to stop the app."
( until curl -s -o /dev/null http://localhost:3000; do sleep 1; done; command -v open >/dev/null && open "http://localhost:3000" ) &
npm start
