import { AppShell } from "@/components/layout/AppShell";
import { TemplateList } from "@/features/templates/template-list";
import { getTemplatesList } from "@/features/templates/actions";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const templates = await getTemplatesList();

  return (
    <AppShell>
      <h1 className="terminal-glow text-xl font-semibold tracking-tight">Bill templates</h1>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Recurring bill defaults. Used when creating a new month from a previous one.
      </p>
      <div className="mt-4">
        <TemplateList templates={templates} />
      </div>
    </AppShell>
  );
}
