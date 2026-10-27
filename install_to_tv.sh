#!/bin/zsh
# Build, sign, install and open the launcher on the TV.   Usage:  ./install_to_tv.sh [tv-ip]
# Needs: Tizen SDK in ~/tizen-studio, the TV in Developer Mode, and a certificate profile made in Certificate Manager.
# Your TV address and certificate profile name go in .tv.env (git-ignored):
#     TV_IP=192.168.x.x
#     TIZEN_PROFILE=your-certificate-profile
# The TV's Developer Mode "Host PC IP" must be the computer address the TV sees (if the computer has both Wi-Fi and
# Ethernet, that is the one `route -n get <tv-ip>` shows).
set -e
HERE="${0:A:h}"
[ -f "$HERE/.tv.env" ] && source "$HERE/.tv.env"
TV_IP="${1:-$TV_IP}"
[ -n "$TV_IP" ] || { echo "Pass the TV's address (./install_to_tv.sh 192.168.x.x) or set TV_IP in .tv.env"; exit 1; }
[ -n "$TIZEN_PROFILE" ] || { echo "Set TIZEN_PROFILE (your certificate profile name) in the environment or in .tv.env"; exit 1; }
DEV="$TV_IP:26101"
PROFILE="$TIZEN_PROFILE"
APP_ID="HomeLaunch.Launcher"
TIZEN=~/tizen-studio/tools/ide/bin/tizen
SDB=~/tizen-studio/tools/sdb

# Stage only what the TV needs: no relay/, .venv, README, .git
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/wallpapers" "$STAGE/icons"
(cd "$HERE" && cp index.html style.css app.js config.js screensaver.js remote.js notifications.js agenda.js config.xml icon.png "$STAGE/")
if [ -f "$HERE/config.local.js" ]; then cp "$HERE/config.local.js" "$STAGE/"; else : > "$STAGE/config.local.js"; fi
cp "$HERE"/wallpapers/*.{jpg,jpeg,png}(N) "$STAGE/wallpapers/"
cp "$HERE"/icons/*.jpg(N) "$STAGE/icons/"

"$SDB" connect "$TV_IP" | tail -1
cd "$STAGE"
"$TIZEN" package -t wgt -s "$PROFILE" -- "$STAGE" | tail -1
# The TV's installer fails on file names containing a space ("Home Launcher.wgt"), so rename first.
mv "Home Launcher.wgt" HomeLauncher.wgt
"$TIZEN" install -n HomeLauncher.wgt -s "$DEV" | tail -3
"$TIZEN" run -p "$APP_ID" -s "$DEV" | tail -2
