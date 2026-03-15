import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <AppShell>
      <h1 className="terminal-glow text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-lg">
        Reference and app info. These sections are informational only; nothing here is clickable.
      </p>
      <div className="mt-6 max-w-lg space-y-6">
        <Card className="pointer-events-none">
          <CardHeader>
            <CardTitle className="text-base">Default ledger</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Household (MVP uses a single ledger. Multi-ledger support can be added later.)
          </CardContent>
        </Card>
        <Card className="pointer-events-none">
          <CardHeader>
            <CardTitle className="text-base">Color legend</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Each color on the month view represents one paycheck window. Bills are grouped by when income arrives; you can manually assign a bill to a different paycheck if needed.
          </CardContent>
        </Card>
        <Card className="pointer-events-none">
          <CardHeader>
            <CardTitle className="text-base">Change password</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Update <code className="rounded bg-muted px-1">ADMIN_PASSWORD</code> in your environment and restart the app. In-app password change will be added in a future update.
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
