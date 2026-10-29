#!/usr/bin/env bash
# Run as root on Ubuntu/Debian: sudo bash deploy/install-notify.sh
set -Eeuo pipefail

REPO_URL="https://github.com/stepweaver/weaver-bill-planner.git"
APP_DIR="/opt/ledger"
ENV_DIR="/etc/ledger"
ENV_FILE="$ENV_DIR/notify.env"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run this script with sudo." >&2
  exit 1
fi
for executable in git npm node systemctl runuser; do
  command -v "$executable" >/dev/null || {
    echo "Missing $executable. Install Git, Node.js 20+ and npm, then rerun." >&2
    exit 1
  }
done
node -e 'if (+process.versions.node.split(".")[0] < 20) process.exit(1)' || {
  echo "Node.js 20 or newer is required." >&2
  exit 1
}

if ! id ledger >/dev/null 2>&1; then
  useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin ledger
fi
if [[ -e "$APP_DIR" && ! -d "$APP_DIR/.git" ]]; then
  echo "$APP_DIR exists but is not a Git checkout. Resolve manually; no files changed." >&2
  exit 1
fi
if [[ ! -d "$APP_DIR/.git" ]]; then
  git clone "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" fetch origin main
  git -C "$APP_DIR" checkout main
  git -C "$APP_DIR" pull --ff-only origin main
fi
chown -R ledger:ledger "$APP_DIR"
runuser -u ledger -- bash -c 'cd /opt/ledger && npm ci --no-audit --no-fund'

install -d -m 750 -o root -g ledger "$ENV_DIR"
if [[ ! -e "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<'EOF'
# Set to the same production Neon database used by the deployed web app.
DATABASE_URL=
# Use the exact same VAPID keys as the web app, not a new pair.
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com
EOF
fi
chown root:ledger "$ENV_FILE"
chmod 640 "$ENV_FILE"

install -m 644 "$APP_DIR/deploy/ledger-notify.service" /etc/systemd/system/ledger-notify.service
install -m 644 "$APP_DIR/deploy/ledger-notify.timer" /etc/systemd/system/ledger-notify.timer
systemctl daemon-reload

echo
echo "Installed the Ledger notification app and systemd units."
echo "NEXT: sudo nano $ENV_FILE"
echo "Fill DATABASE_URL and the matching VAPID values, then save."
echo "Then run:"
echo "  sudo systemctl start ledger-notify.service  # real notifications; do only when ready"
echo "  sudo systemctl enable --now ledger-notify.timer"
echo "  systemctl list-timers ledger-notify.timer"
echo "For a safe dry run first:"
echo "  sudo runuser -u ledger -- bash -c 'cd /opt/ledger && set -a && source /etc/ledger/notify.env && set +a && npm run notify:dry-run'"
