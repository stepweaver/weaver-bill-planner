"use client";

import type { PaycheckWindowSummary } from "@/lib/month-funding";
import type { PaycheckWindow } from "@/lib/paycheck-windows";
import { paycheckBadgeClass } from "@/lib/paycheck-window-styles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function formatMoney(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function PaycheckRail({
  windows,
  summaries,
  selectedWindowKey,
  onSelectWindow,
  hasActiveFilter,
  onClearFilter,
}: {
  windows: PaycheckWindow[];
  summaries: PaycheckWindowSummary[];
  selectedWindowKey: string | null;
  onSelectWindow: (key: string | null) => void;
  /** True when any bill filter applies (paycheck or unassigned-only) */
  hasActiveFilter: boolean;
  onClearFilter: () => void;
}) {
  const byKey = new Map(summaries.map((s) => [s.windowKey, s]));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-medium">Paychecks</h2>
        {hasActiveFilter && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={onClearFilter}
          >
            Clear filter
          </Button>
        )}
      </div>
      <ul className="space-y-2">
        {windows.map((w) => {
          const s = byKey.get(w.key);
          if (!s) return null;
          const selected = selectedWindowKey === w.key;
          return (
            <li key={w.key}>
              <button
                type="button"
                onClick={() => onSelectWindow(selected ? null : w.key)}
                className={cn(
                  "w-full rounded-md border px-3 py-2.5 text-left text-xs transition-colors",
                  selected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
                  s.overExpected && "border-orange-500/50 bg-orange-500/5"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={cn(
                      "inline-flex max-w-[70%] truncate rounded px-1.5 py-0.5 text-[11px] font-medium",
                      paycheckBadgeClass(w.colorKey)
                    )}
                  >
                    {w.label}
                  </span>
                  {s.overExpected && (
                    <span className="shrink-0 text-[10px] font-medium text-orange-700 dark:text-orange-300">
                      Over expected
                    </span>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 tabular-nums text-muted-foreground">
                  <span>Expected</span>
                  <span className="text-right text-foreground">{formatMoney(s.expectedIncome)}</span>
                  <span>Unpaid bills</span>
                  <span className="text-right text-foreground">{formatMoney(s.unpaidPlannedTotal)}</span>
                  <span>Cushion</span>
                  <span
                    className={cn(
                      "text-right font-medium",
                      s.paycheckCushion != null && s.paycheckCushion < 0
                        ? "text-orange-700 dark:text-orange-300"
                        : "text-foreground"
                    )}
                  >
                    {formatMoney(s.paycheckCushion)}
                  </span>
                  <span className="col-span-2 text-[10px] normal-case">
                    {s.unpaidBillCount} unpaid · {s.billCount} total in window
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-[10px] text-muted-foreground leading-snug">
        Cushion is expected paycheck minus unpaid bill totals for that paycheck (all windows tied to
        the same deposit). Planning figure, not bank balance.
      </p>
    </div>
  );
}
