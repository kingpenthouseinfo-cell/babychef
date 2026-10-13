#!/bin/bash
# Started by the Update button in Settings (or by hand). Stops the app, pulls the newest code, rebuilds, starts it again.
# Your data in ~/Documents/Baby Chef Studio is never touched. Log: ~/Library/Logs/BabyChefUpdate.log
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$HOME/Library/Logs/BabyChefUpdate.log"
mkdir -p "$HOME/Library/Logs"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
{
  echo "=== Update started $(date)"
  cd "$APP_DIR" || exit 1
  sleep 2
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  # stop the running app
  for p in $(/usr/sbin/lsof -ti:3000 2>/dev/null); do kill "$p" 2>/dev/null; done
  sleep 2
  if git pull --ff-only origin "$BRANCH"; then
    npm install && npx prisma generate && npm run build
  else
    echo "git pull failed — starting the old version again"
  fi
  # start again in the background
  nohup /bin/bash -lc "cd '$APP_DIR' && npm start" >> "$HOME/Library/Logs/BabyChefStudio.log" 2>&1 &
  echo "=== Update finished $(date)"
} >> "$LOG" 2>&1
