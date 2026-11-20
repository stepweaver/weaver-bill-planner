import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotificationControls } from "@/features/notifications/notification-controls";
import { getNotificationSetup, listNotificationFailures } from "@/features/notifications/actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const setup = await getNotificationSetup();
  const history = await listNotificationFailures();
  const publicKey = "publicKey" in setup ? setup.publicKey : null;

  return (
    <AppShell>
      <h1 className="terminal-glow text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-lg">
        Turn on alerts here. Everything else is for reference.
      </p>
      <div className="mt-6 max-w-lg space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <NotificationControls
              publicKey={publicKey}
              ready={history.ready}
              failures={history.ready ? history.failures : []}
            />
          </CardContent>
        </Card>
        <Card className="pointer-events-none">
          <CardHeader>
            <CardTitle className="text-base">Default ledger</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Household
          </CardContent>
        </Card>
        <Card className="pointer-events-none">
          <CardHeader>
            <CardTitle className="text-base">Color legend</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Colors show which payday covers each bill. Change the assignment if needed.
          </CardContent>
        </Card>
        <Card className="pointer-events-none">
          <CardHeader>
            <CardTitle className="text-base">Change password</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Update <code className="rounded bg-muted px-1">AUTHORIZED_USERS</code> in your environment and restart the app. In-app password change will be added in a future update.
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
