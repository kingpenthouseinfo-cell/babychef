#!/bin/bash
# Double-click to pull the newest Baby Chef Studio code (your data in ~/Documents/Baby Chef Studio is never touched).
# Needs a git copy of the project:  git clone -b claude/baby-chef-studio-spec-i8do7s https://github.com/kingpenthouseinfo-cell/babychef.git ~/bcs-git
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
BRANCH="claude/baby-chef-studio-spec-i8do7s"
if [ ! -d .git ]; then echo "This folder is not a git copy, so it can't update itself."; echo "Clone it once with:"; echo "  git clone -b $BRANCH https://github.com/kingpenthouseinfo-cell/babychef.git ~/bcs-git"; read -n 1 -s -r -p "Press any key to close"; exit 1; fi
git fetch origin "$BRANCH" && git checkout "$BRANCH" && git pull --ff-only origin "$BRANCH" || { echo "Update failed (see above)."; read -n 1 -s -r -p "Press any key to close"; exit 1; }
npm install && npx prisma generate
echo; echo "Updated. If the app is running with 'npm run dev' just refresh the browser. Otherwise run:  npm run dev"
sleep 2
