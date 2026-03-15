import { AppShell } from "@/components/layout/AppShell";
import { CreateMonthWizard } from "@/features/months/create-month-wizard";
import { getMonthsList } from "@/features/months/actions";

export const dynamic = "force-dynamic";

export default async function NewMonthPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const params = await searchParams;
  const monthsList = await getMonthsList();
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">Create new month</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Copy recurring bills and income from a source month. Review and adjust before saving.
      </p>
      <div className="mt-6">
        <CreateMonthWizard
          monthsList={monthsList}
          defaultFromKey={params.from ?? undefined}
        />
      </div>
    </AppShell>
  );
}
