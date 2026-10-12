#!/bin/bash
# Double-click to start Baby Chef Studio. Leave this window open while you use it; close it (or press Control+C) to stop.
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then echo "Node.js is not installed. Install it from https://nodejs.org and try again."; read -n 1 -s -r -p "Press any key to close"; exit 1; fi
[ -d node_modules ] || npm install
( for i in $(seq 1 180); do curl -s -o /dev/null http://localhost:3000 && { open http://localhost:3000; break; }; sleep 1; done ) &
npm start
