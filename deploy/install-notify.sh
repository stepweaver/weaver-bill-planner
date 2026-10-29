#!/usr/bin/env bash
# Install the notification timer alongside the existing Ledger app.
# Run as: sudo bash deploy/install-notify.sh
set -Eeuo pipefail

APP_DIR="/srv/apps/ledger"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run with sudo." >&2
  exit 1
fi
if ! id weaver >/dev/null 2>&1; then
  echo "The existing weaver account was not found." >&2
  exit 1
fi
if [[ ! -f "$APP_DIR/package.json" || ! -f "$APP_DIR/src/jobs/notify.ts" ]]; then
  echo "Ledger notification sources are missing from $APP_DIR." >&2
  echo "Update the existing checkout using your normal deployment process first." >&2
  exit 1
fi
if ! grep -q '"notify"' "$APP_DIR/package.json"; then
  echo "The npm notify script was not found." >&2
  exit 1
fi
if [[ ! -f "$APP_DIR/deploy/ledger-notify.service" || ! -f "$APP_DIR/deploy/ledger-notify.timer" ]]; then
  echo "Service/timer files are not present. Update your deployed checkout." >&2
  exit 1
fi

install -m 644 "$APP_DIR/deploy/ledger-notify.service" /etc/systemd/system/ledger-notify.service
install -m 644 "$APP_DIR/deploy/ledger-notify.timer" /etc/systemd/system/ledger-notify.timer
systemctl daemon-reload

echo "Installed notification service and timer alongside the existing Ledger deployment."
echo "The timer is NOT enabled or started."
echo "The existing ledger.service was not changed."
echo
echo "NEXT: check the existing /srv/apps/ledger/.env.local or create"
echo "      /etc/ledger/notify.env (optional override)."
echo "Both must use the same production DATABASE_URL and VAPID key pair."
echo "The optional override must be readable by weaver and secured to 0600"
echo "if owned by weaver, or 0640 with a group accessible to weaver."
echo
echo "Dry run as weaver (uses app's .env.local):"
echo "  sudo -u weaver bash -c 'cd /srv/apps/ledger && npm run notify:dry-run'"
echo
echo "Then, only when ready:"
echo "  sudo systemctl enable --now ledger-notify.timer"
echo "  systemctl list-timers --all ledger-notify.timer"
