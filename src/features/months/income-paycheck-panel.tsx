"use client";

import { AddIncomeButton } from "@/features/income/add-income-button";
import { IncomeList } from "@/features/income/income-list";
import { PaycheckRail } from "./paycheck-rail";
import type { PaycheckWindowSummary } from "@/lib/month-funding";
import type { PaycheckWindow } from "@/lib/paycheck-windows";

type IncomeEvent = {
  id: number;
  name: string;
  expectedDate: string;
  expectedAmount: number | null;
  actualAmount: number | null;
  status: string;
  notes: string | null;
};

export function IncomePaycheckPanel({
  monthId,
  monthKey,
  incomeEvents,
  windows,
  paycheckSummaries,
  selectedWindowKey,
  onSelectWindow,
  hasActiveFilter,
  onClearFilter,
}: {
  monthId: number;
  monthKey: string;
  incomeEvents: IncomeEvent[];
  windows: PaycheckWindow[];
  paycheckSummaries: PaycheckWindowSummary[];
  selectedWindowKey: string | null;
  onSelectWindow: (key: string | null) => void;
  hasActiveFilter: boolean;
  onClearFilter: () => void;
}) {
  return (
    <div className="space-y-5">
      <PaycheckRail
        windows={windows}
        summaries={paycheckSummaries}
        selectedWindowKey={selectedWindowKey}
        onSelectWindow={onSelectWindow}
        hasActiveFilter={hasActiveFilter}
        onClearFilter={onClearFilter}
      />

      <div className="space-y-2 border-t border-border/70 pt-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">Income events</h3>
          <AddIncomeButton monthId={monthId} monthKey={monthKey} />
        </div>
        <IncomeList events={incomeEvents} monthKey={monthKey} />
      </div>
    </div>
  );
}
