# λledger notification timer on the existing VPS

This deployment already runs as user `weaver` in `/srv/apps/ledger`, through `ledger.service`. The separate `ledger-notify.service` runs a one-shot scheduled job from the **same source directory**. It does not restart or modify `ledger.service`, create another user, or clone the repository.

## Verify existing app first

```bash
whoami
pwd
sudo systemctl status ledger --no-pager
node -v
npm -v
test -f src/jobs/notify.ts && echo "Notification source present"
npm run | grep notify
```

If the notification source is missing, update the existing app checkout using your established deployment process. Do not replace it with a new clone or reinstall dependencies solely for this timer.

## Configure environment

The job's `src/jobs/notify.ts` loads `/srv/apps/ledger/.env.local` from its working directory. Ensure the existing app configuration includes the production Neon `DATABASE_URL` and the **same** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` as the web app. The service also supports an optional `/etc/ledger/notify.env` override; when present, protect it and ensure it is readable by user `weaver`. Never print secrets in a terminal screenshot or commit them.

Verify that the `drizzle/0006_bill_float.sql` and `drizzle/0007_push_notifications.sql` migrations are present in your database before testing. Do not blindly apply `db:push` in production.

## Install timer definitions

After merging this PR and deploying the updated source to `/srv/apps/ledger`:

```bash
cd /srv/apps/ledger
sudo bash deploy/install-notify.sh
systemd-analyze verify /etc/systemd/system/ledger-notify.service /etc/systemd/system/ledger-notify.timer
systemd-analyze calendar '*-*-* 09:00:00 America/Indiana/Indianapolis'
```

The installer only copies systemd units and reloads systemd. It does not start a notification job.

## Dry run

```bash
cd /srv/apps/ledger
sudo -u weaver bash -c 'cd /srv/apps/ledger && npm run notify:dry-run'
```

Expect JSON with `dryRun: true`, candidate bills, payday events, and subscription count. No notifications are sent. Use Settings in the installed phone web app to enable notifications and send a test push.

## Activate

```bash
sudo systemctl enable --now ledger-notify.timer
systemctl list-timers --all ledger-notify.timer
```

The timer is set for 9 AM Indianapolis time, including daylight-saving changes.

To manually execute the real job when you intend to send any eligible reminders:

```bash
sudo systemctl start ledger-notify.service
sudo journalctl -u ledger-notify.service -n 100 --no-pager
```

To stop notifications:

```bash
sudo systemctl disable --now ledger-notify.timer
```

Notifications only occur for scheduled bills due today, floated bills resurfacing today, or today's expected payday. Already-overdue scheduled bills do not repeatedly notify each day. No incoming port is needed. 
