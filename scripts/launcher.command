#!/bin/bash
# Baby Chef Studio — one double-click to START, and it UPDATES itself from GitHub first (or from a newer zip in Downloads if you are offline).
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
REPO="kingpenthouseinfo-cell/babychef"
BRANCH="$(cat "$APP/.branch" 2>/dev/null || echo claude/baby-chef-studio-spec-i8do7s)"
# stop a copy that is already running
PIDS="$(lsof -ti:3000 2>/dev/null)"; [ -n "$PIDS" ] && kill $PIDS 2>/dev/null && sleep 2

# 1) is there a newer version on GitHub?
SRC=""; NEWSHA=""
LATEST="$(curl -fsS -m 8 -H 'Accept: application/vnd.github.sha' "https://api.github.com/repos/$REPO/commits/$BRANCH" 2>/dev/null)"
if [ "${#LATEST}" -eq 40 ] && [ "$LATEST" != "$(cat "$APP/.installed-sha" 2>/dev/null)" ]; then
  say "Downloading the newest Baby Chef Studio …"
  GZ="$(mktemp -d)/new.zip"
  if curl -fsSL -m 300 -o "$GZ" "https://github.com/$REPO/archive/refs/heads/$BRANCH.zip"; then SRC="$GZ"; NEWSHA="$LATEST"; fi
fi
# 2) offline? fall back to a newer zip in Downloads
if [ -z "$SRC" ]; then
  ZIP="$(ls -t "$HOME"/Downloads/baby-chef-studio*.zip 2>/dev/null | head -1)"
  if [ -n "$ZIP" ] && { [ ! -d "$APP" ] || [ "$ZIP" -nt "$APP/.installed-from" ]; }; then SRC="$ZIP"; fi
fi

if [ -n "$SRC" ]; then
  say "Updating …"
  TMP="$(mktemp -d)"
  unzip -q "$SRC" -d "$TMP" || { echo "That download could not be opened."; pause; }
  NEWDIR="$(find "$TMP" -mindepth 1 -maxdepth 1 -type d | head -1)"
  [ -f "$NEWDIR/package.json" ] || { echo "That does not look like Baby Chef Studio."; pause; }
  BACKUP=""
  if [ -d "$APP" ]; then BACKUP="$APP-OLD-$(date +%Y%m%d-%H%M%S)"; mv "$APP" "$BACKUP"; fi
  mv "$NEWDIR" "$APP"
  cd "$APP" || exit 1
  cp .env.example .env
  if npm install && npx prisma generate; then
    touch "$APP/.installed-from"; [ -n "$NEWSHA" ] && echo "$NEWSHA" > "$APP/.installed-sha"; echo "$BRANCH" > "$APP/.branch"
    cp -f "$APP/scripts/launcher.command" "$HOME/Desktop/Baby Chef Studio.command" 2>/dev/null && chmod +x "$HOME/Desktop/Baby Chef Studio.command"
  else
    echo; echo "The update did not finish. Putting your old version back."
    cd "$HOME"; rm -rf "$APP"; [ -n "$BACKUP" ] && mv "$BACKUP" "$APP"
    pause
  fi
elif [ ! -d "$APP" ]; then
  say "Could not download Baby Chef Studio (are you online?)."
  echo "Connect to the internet and double-click this file again."
  pause
fi

cd "$APP" || exit 1
say "Starting Baby Chef Studio … (the first start after an update takes a few minutes)"
echo "Your browser opens by itself when it is ready. Close this window to stop the app."
( until curl -s -o /dev/null http://localhost:3000; do sleep 1; done; command -v open >/dev/null && open "http://localhost:3000" ) &
npm start
