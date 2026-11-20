# λledger pocket companion: notifications and VPS rollout

The existing app runs as user `weaver` in `/srv/apps/ledger` through `ledger.service`. Its separate `ledger-notify.service` and `ledger-notify.timer` execute from the **same checkout**. Do not clone another application or add a second cron job. The timer schedule remains 9 AM, 1 PM and 6 PM in `America/Indiana/Indianapolis`.

## Notification policy

- **9 AM:** One discreet summary for bills due within two days, due today, overdue (including prior-month carryovers), and floated obligations resurfacing. Scheduled paydays are included, but users must still verify the deposit.
- **1 PM:** An unacknowledged payday follow-up. Bill-only reminders are suppressed at this slot to reduce noise.
- **6 PM:** An unresolved due/overdue/floated-bill follow-up. Payday-only reminders are suppressed at this slot.
- Marking a bill **sent/pending**, **paid**, **skipped** or actively **floated** removes it from bill-reminder candidates. A settled scheduled record with a fully recorded amount is likewise ignored.
- Tapping a notification opens the current month. The Now dashboard prioritizes overdue carryovers.
- Dedupe keys are per date, slot and subscription. Concurrent jobs atomically claim one delivery; stale `sending` claims can be retried after 30 minutes, with at most 3 attempts total. A provider acknowledgment before a worker crash could still yield a duplicate, since push delivery cannot guarantee exactly once.
- No notifications are sent outside **8 AM–9 PM** local time, including delayed systemd timer catch-ups. Dry-run reports do not send pushes.
- Push messages never include bill names or financial amounts.

The user must have a supported browser / PWA, permission granted, and a registered subscription. For iOS, add λledger to the Home Screen and launch it from there before enabling notifications in Settings.

## Verify the existing VPS checkout

```bash
ssh YOUR_VPS_HOST
cd /srv/apps/ledger
whoami
git status --short
git branch --show-current
sudo systemctl status ledger --no-pager
sudo systemctl list-timers --all ledger-notify.timer
```

Stop and handle uncommitted changes rather than overwriting them. The app should continue running from the existing directory. Never print `.env.local` or secrets.

## After merging the PR

```bash
cd /srv/apps/ledger
git switch main
git pull --ff-only origin main
npm ci
npm test
npx tsc --noEmit
npm run lint
npm run build
```

If any check fails, do **not** restart the live service. This change does not introduce a database migration. Do not run `db:push`, `db:seed`, or apply migrations as a reflex.

Restart the app after a successful build:

```bash
sudo systemctl restart ledger.service
sudo systemctl status ledger.service --no-pager
sudo journalctl -u ledger.service -n 60 --no-pager
```

## Refresh the separate reminder timer

```bash
cd /srv/apps/ledger
sudo bash deploy/install-notify.sh
sudo systemd-analyze verify /etc/systemd/system/ledger-notify.service /etc/systemd/system/ledger-notify.timer
sudo systemctl enable --now ledger-notify.timer
sudo systemctl restart ledger-notify.timer
systemctl list-timers --all ledger-notify.timer
```

This changes the timer's installed unit file, but does not execute notifications immediately. The oneshot job reads the same `.env.local` as the app (with optional `/etc/ledger/notify.env`). Make sure the `DATABASE_URL` and VAPID keys already work. Do not rotate keys unnecessarily because that invalidates existing subscriptions.

## Verify before sending anything

```bash
cd /srv/apps/ledger
sudo -u weaver bash -c 'cd /srv/apps/ledger && npm run notify:dry-run'
sudo journalctl -u ledger-notify.service -n 80 --no-pager
```

Check `subscriptions` > 0, `shouldNotify`, `kind`, `overdueCarryoverBillIds`, `dueBillIds`, `upcomingBillIds`, `paydayNames`, `dryRun: true`, and the timezone. No push is sent during this command.

To deliberately send a **real** reminder for currently eligible items (only after confirming the dry run and phone subscription):

```bash
sudo systemctl start ledger-notify.service
sudo systemctl status ledger-notify.service --no-pager
sudo journalctl -u ledger-notify.service -n 100 --no-pager
```

The job may legitimately send zero notifications if nothing is due, the payday has been acknowledged, the slot has already sent, or the current hour is quiet. Use Settings → Notifications → Send test to independently verify that device delivery works.

For investigation:

```bash
sudo systemctl list-timers --all ledger-notify.timer
sudo systemctl status ledger-notify.timer ledger-notify.service --no-pager
sudo journalctl -u ledger-notify.service --since "2 days ago" --no-pager
```

To disable scheduled pushes without stopping the website:

```bash
sudo systemctl disable --now ledger-notify.timer
```

## Important operational limitations

These reminders only reflect correctly entered bill statuses, dates, and expected income. They cannot verify a bank deposit or bill payment independently. A power outage, unavailable provider, browser permission revocation, disabled subscription or server failure can interrupt delivery. Treat notifications as an aid to checking the dashboard, not the sole mechanism for meeting financial deadlines.
