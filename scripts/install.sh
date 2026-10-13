#!/bin/bash
# One-time install of Baby Chef Studio that can update itself from GitHub.
#   curl -fsSL https://raw.githubusercontent.com/kingpenthouseinfo-cell/babychef/claude/baby-chef-studio-spec-i8do7s/scripts/install.sh | bash
# The app code goes to ~/Baby Chef Studio App. Your recipes, pictures and database stay in ~/Documents/Baby Chef Studio (never touched).
set -e
BRANCH="claude/baby-chef-studio-spec-i8do7s"
REPO="https://github.com/kingpenthouseinfo-cell/babychef.git"
DEST="$HOME/Baby Chef Studio App"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
say() { printf "\n\033[1m%s\033[0m\n" "$1"; }
if ! command -v node >/dev/null 2>&1; then say "Node.js is not installed."; echo "Install it from https://nodejs.org (the LTS button), then run this again."; exit 1; fi
if ! command -v git >/dev/null 2>&1; then say "Git is needed."; echo "A window may pop up asking to install the developer tools. Click Install, wait, then run this again."; xcode-select --install 2>/dev/null || true; exit 1; fi
if [ -d "$DEST/.git" ]; then
  say "Already installed - updating it"
  cd "$DEST" && git fetch origin "$BRANCH" && git checkout "$BRANCH" && git pull --ff-only origin "$BRANCH"
else
  say "Downloading Baby Chef Studio"
  git clone -b "$BRANCH" "$REPO" "$DEST"
  cd "$DEST"
fi
say "Installing (a few minutes)"
npm install
npx prisma generate
npm run build
say "Making the app icon"
bash scripts/make-mac-app.sh "$HOME/Applications"
if [ -d "$HOME/Desktop" ]; then rm -rf "$HOME/Desktop/Baby Chef Studio.app"; cp -R "$HOME/Applications/Baby Chef Studio.app" "$HOME/Desktop/Baby Chef Studio.app"; fi
say "Done!"
echo "Double-click 'Baby Chef Studio' on your Desktop (also in your Applications folder) to open it."
echo "To update later: open the app, then Settings > Baby Chef Studio app > UPDATE NOW."
echo "To quit: Settings > QUIT BABY CHEF STUDIO."
open "$HOME/Applications" 2>/dev/null || true
