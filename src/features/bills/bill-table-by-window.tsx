import { BillRow } from "./bill-row";
import { AddBillButton } from "./add-bill-button";
import type { PaycheckWindow } from "@/lib/paycheck-windows";

type BillInstance = {
  id: number;
  name: string;
  dueDate: string | null;
  plannedAmount: number | null;
  invoiceAmount: number | null;
  amountPaid: number | null;
  status: string;
  notes: string | null;
  paymentUrl: string | null;
  displayWindowKey: string | null;
  displayIncomeEventId: number | null;
  assignedIncomeEventId: number | null;
  assignedGroupKey: string | null;
  manualAssignment: boolean | null;
  templateId: number | null;
  updatedAt?: Date | string | null;
};

/** Due date ascending, then stable id tie-break (order does not change when status updates). */
function sortBillsByDueDateThenId(bills: BillInstance[]): BillInstance[] {
  return [...bills].sort((a, b) => {
    const dateA = a.dueDate ?? "";
    const dateB = b.dueDate ?? "";
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return a.id - b.id;
  });
}

const COLOR_CLASSES: Record<string, string> = {
  rose: "bg-rose-500/10 border-l-4 border-rose-500",
  blue: "bg-blue-500/10 border-l-4 border-blue-500",
  amber: "bg-amber-500/10 border-l-4 border-amber-500",
  green: "bg-green-500/10 border-l-4 border-green-500",
  violet: "bg-violet-500/10 border-l-4 border-violet-500",
  slate: "bg-slate-500/10 border-l-4 border-slate-500",
};

export function BillTableByWindow({
  windows,
  bills,
  monthId,
  monthKey,
}: {
  windows: PaycheckWindow[];
  bills: BillInstance[];
  monthId: number;
  monthKey: string;
}) {
  const billsByWindow = new Map<string, BillInstance[]>();
  for (const b of bills) {
    const key = b.displayWindowKey ?? "unassigned";
    if (!billsByWindow.has(key)) billsByWindow.set(key, []);
    billsByWindow.get(key)!.push(b);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium">Bills by paycheck window</h2>
        <AddBillButton monthId={monthId} monthKey={monthKey} windows={windows} />
      </div>
      {windows
        .filter((win) => (billsByWindow.get(win.key) ?? []).length > 0)
        .map((win) => {
          const winBills = sortBillsByDueDateThenId(billsByWindow.get(win.key) ?? []);
          const isBefore = win.key.startsWith("pre-");
          const colorClass = isBefore
            ? "border-l-4 border-white/30 bg-transparent"
            : (COLOR_CLASSES[win.colorKey] ?? "bg-muted/50");
          return (
            <div key={win.key} className={`rounded border p-2 ${colorClass}`}>
              <div className="min-w-0">
                <ul className="space-y-0 text-xs">
                  {winBills.map((b) => (
                    <BillRow
                      key={b.id}
                      bill={b}
                      monthId={monthId}
                      monthKey={monthKey}
                      windows={windows}
                      as="list"
                    />
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      {billsByWindow.get("unassigned")?.length ? (
        <div className="rounded border border-dashed p-2 bg-muted/30">
          <h3 className="mb-1 text-xs font-medium text-muted-foreground">
            Unassigned
          </h3>
          <div className="min-w-0">
            <ul className="space-y-0 text-xs">
              {sortBillsByDueDateThenId(billsByWindow.get("unassigned")!).map((b) => (
                <BillRow
                  key={b.id}
                  bill={b}
                  monthId={monthId}
                  monthKey={monthKey}
                  windows={windows}
                  as="list"
                />
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
