# λledger VPS notification deployment

These commands install only the background notification job. The website can remain hosted on Vercel. The job uses the same production Neon database and the exact same VAPID key pair as the website.

## 1. Prepare

On your Ubuntu VPS, ensure Node.js 20+ and npm and Git are available:

```bash
node --version
npm --version
git --version
```

Do not create another VAPID pair just for the VPS. Obtain the production values from the deployed application's protected environment settings.

Before enabling push, verify that `drizzle/0006_bill_float.sql` and `drizzle/0007_push_notifications.sql` have been applied to your production Neon database. Apply only missing migrations after reviewing them; do not run `db:push` against production as a shortcut.

## 2. Install

After the associated PR has been merged into main:

```bash
sudo apt-get update
sudo apt-get install -y git
git clone https://github.com/stepweaver/weaver-bill-planner.git ~/weaver-bill-planner
cd ~/weaver-bill-planner
sudo bash deploy/install-notify.sh
```

If the repository is already cloned, just pull main first. The installer sets up `/opt/ledger` and `ledger` system user, runs `npm ci`, creates `/etc/ledger/notify.env` with limited access, and installs the systemd units. It **does not** start the timer.

## 3. Configure secrets

```bash
sudo nano /etc/ledger/notify.env
```

Set the production values. For a database URL containing characters interpreted by the shell (for example `&`), quote the value with single quotes:

```ini
DATABASE_URL='postgresql://...'
VAPID_PUBLIC_KEY='...'
VAPID_PRIVATE_KEY='...'
VAPID_SUBJECT='mailto:you@example.com'
```

Do not paste the keys into GitHub or share them in screenshots. The `VAPID_SUBJECT` should be a real contact address.

## 4. Dry run

```bash
sudo runuser -u ledger -- bash -c 'cd /opt/ledger && set -a && source /etc/ledger/notify.env && set +a && npm run notify:dry-run'
```

Expect a JSON report with today's date, due bills, payday status, subscription count, and `dryRun: true`. A successful dry run will not send pushes.

On the deployed application, open **Settings → Notifications** and enable notifications on the phone. On an iPhone, install Ledger on the Home Screen and launch that installed icon before enabling push. Send a test from the web app.

## 5. Enable the daily schedule

```bash
sudo systemctl enable --now ledger-notify.timer
systemctl list-timers --all ledger-notify.timer
systemd-analyze calendar '*-*-* 09:00:00 America/Indiana/Indianapolis'
```

This fires at 9 AM Indianapolis time, observing daylight-saving transitions. To run the actual job on demand:

```bash
sudo systemctl start ledger-notify.service
sudo journalctl -u ledger-notify.service -n 100 --no-pager
```

There will only be a push if the job finds actionable reminders and a valid subscribed device. Do not repeatedly run manual sends when testing notification delivery.

## 6. Update or troubleshoot

```bash
sudo journalctl -u ledger-notify.service -f
systemctl status ledger-notify.timer --no-pager
sudo systemctl stop ledger-notify.timer
```

For updates after new code is merged, run the installer again from an up-to-date source checkout; it performs a fast-forward-only update in `/opt/ledger` and keeps the protected environment file.

The job is one-shot, not a persistent web server. It does not need an inbound firewall port. Delivery errors appear in the systemd journal and in Ledger Settings.

Note: the current job sends reminders for scheduled bills due today, bills resurfacing from a float today, and recorded income events expected today. It does not send repeated overdue reminders on later dates.
