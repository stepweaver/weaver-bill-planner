"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateAvailableBankBalance } from "@/features/months/actions";
import { parseLocalIsoDate } from "@/lib/month-dates";
import type { MonthPlanningView, PlanningBillLine } from "@/lib/paycheck-snapshot";
import { cn } from "@/lib/utils";

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatShortDate(isoDate: string) {
  return format(parseLocalIsoDate(isoDate), "MMM d");
}

function SnapshotLabel({ children }: { children: string }) {
  return (
    <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </h2>
  );
}

function BillLines({ lines }: { lines: PlanningBillLine[] }) {
  if (lines.length === 0) return null;
  return (
    <ul className="mt-1 space-y-0.5">
      {lines.map((line) => (
        <li key={line.id}>
          <a
            href={`#bill-row-${line.id}`}
            className="flex min-h-11 min-w-0 items-center justify-between gap-3 text-sm hover:underline"
          >
            <span className="min-w-0 truncate">{line.name}</span>
            <span className="shrink-0 tabular-nums">
              {line.dueDate ? (
                <span className="text-muted-foreground">{formatShortDate(line.dueDate)} · </span>
              ) : null}
              {formatMoney(line.amount)}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function AvailableBalanceControl({
  monthKey,
  balance,
  spendable,
  pendingTotal,
  updatedAt,
}: {
  monthKey: string;
  balance: number | null;
  spendable: number | null;
  pendingTotal: number;
  updatedAt: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const showEditor = editing || balance == null;

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function startEdit() {
    setDraft(balance == null ? "" : balance.toFixed(2));
    setEditing(true);
  }

  function toggleSign() {
    setDraft((current) => {
      const trimmed = current.trim();
      if (trimmed.startsWith("-")) return trimmed.slice(1);
      return trimmed ? `-${trimmed}` : "-";
    });
    inputRef.current?.focus();
  }

  async function onSave() {
    if (saving) return;
    setSaving(true);
    try {
      const result = await updateAvailableBankBalance(monthKey, draft);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      toast.error("Couldn't save the balance.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <SnapshotLabel>Available bank balance</SnapshotLabel>
        {balance != null && !showEditor ? (
          <button
            type="button"
            onClick={startEdit}
            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            Update
          </button>
        ) : null}
      </div>
      {showEditor ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void onSave();
          }}
        >
          <Input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            placeholder="0.00"
            aria-label="Available bank balance"
            disabled={saving}
            className="h-11 min-w-0 flex-1 text-base tabular-nums"
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 w-11 shrink-0 px-0 text-base"
            aria-label="Toggle negative amount"
            disabled={saving}
            onClick={toggleSign}
          >
            ±
          </Button>
          <Button type="submit" className="h-11 shrink-0 px-4" disabled={saving}>
            {saving ? "Saving" : "Save"}
          </Button>
          {balance != null ? (
            <Button
              type="button"
              variant="ghost"
              className="h-11 shrink-0 px-2"
              disabled={saving}
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          ) : null}
        </form>
      ) : (
        <button
          type="button"
          onClick={startEdit}
          className={cn(
            "block text-left text-xl font-semibold tabular-nums tracking-tight",
            (spendable ?? 0) < 0 && "text-rose-700 dark:text-rose-300"
          )}
        >
          {formatMoney(spendable ?? 0)}
        </button>
      )}
      <p className="text-[11px] text-muted-foreground">
        {showEditor ? (
          pendingTotal > 0 ? (
            "Enter what the bank shows. Pending payments are subtracted from it."
          ) : (
            "What your bank shows as available to spend."
          )
        ) : pendingTotal > 0 && balance != null ? (
          <>
            {formatMoney(balance)} at the bank. {formatMoney(pendingTotal)} pending is already spent.
            {updatedAt ? (
              <>
                {" "}
                <time dateTime={updatedAt} suppressHydrationWarning>
                  Updated {format(new Date(updatedAt), "MMM d, h:mm a")}
                </time>
              </>
            ) : null}
          </>
        ) : updatedAt ? (
          <time dateTime={updatedAt} suppressHydrationWarning>
            Updated {format(new Date(updatedAt), "MMM d, h:mm a")}
          </time>
        ) : (
          "What your bank shows as available to spend."
        )}
      </p>
    </div>
  );
}

export function PlanningSnapshot({
  monthKey,
  operational,
  liveMonth,
  availableBalance,
  availableBalanceUpdatedAt,
  planning,
}: {
  monthKey: string;
  operational: boolean;
  liveMonth: { href: string; label: string } | null;
  availableBalance: number | null;
  availableBalanceUpdatedAt: string | null;
  planning: MonthPlanningView;
}) {
  const next = planning.nextIncome;
  const safe = planning.safeUntilNextIncome;

  return (
    <section aria-label="Planning snapshot" className="divide-y divide-border border-y border-border">
      <div className="space-y-3 py-3">
        {operational ? (
          <>
            <AvailableBalanceControl
              monthKey={monthKey}
              balance={availableBalance}
              spendable={planning.availableAfterPending}
              pendingTotal={planning.pendingClearanceTotal}
              updatedAt={availableBalanceUpdatedAt}
            />

            {next ? (
              <>
                <div>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <SnapshotLabel>Before next paycheck</SnapshotLabel>
                    <p className="text-right text-sm tabular-nums">
                      <span className="font-semibold">{formatMoney(planning.needsFundingTotal)}</span>
                      <span className="text-muted-foreground"> needs funding</span>
                    </p>
                  </div>
                  {planning.needsFunding.length > 0 ? (
                    <BillLines lines={planning.needsFunding} />
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Nothing left to start before the next paycheck.
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <SnapshotLabel>Safe until next paycheck</SnapshotLabel>
                    {safe != null ? (
                      <p
                        className={cn(
                          "text-right text-xl font-semibold tabular-nums tracking-tight",
                          safe < 0 && "text-rose-700 dark:text-rose-300"
                        )}
                      >
                        {formatMoney(safe)}
                      </p>
                    ) : (
                      <p className="text-right text-xs text-muted-foreground">Enter the available balance</p>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Available balance, after pending, minus bills still needing payment before the next income.
                  </p>
                </div>

                <div>
                  <SnapshotLabel>Next paycheck</SnapshotLabel>
                  <p className="text-sm tabular-nums">
                    <span className="font-medium">{next.names.join(" + ")}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {formatShortDate(next.date)} · {formatMoney(next.expectedAmount)}
                    </span>
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No income left in this month, so there is no safe-until figure.
              </p>
            )}

            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <SnapshotLabel>Pending clearance</SnapshotLabel>
                <p className="text-right text-sm tabular-nums">
                  <span className="font-semibold">
                    {planning.pendingClearance.length} · {formatMoney(planning.pendingClearanceTotal)}
                  </span>
                </p>
              </div>
              {planning.pendingClearance.length > 0 ? (
                <>
                  <BillLines lines={planning.pendingClearance} />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Open a payment to mark it paid. This amount is already subtracted from the available balance.
                  </p>
                </>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">No payments waiting to clear.</p>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Today’s available bank balance is kept on the current month.
            {liveMonth ? (
              <>
                {" "}
                <Link href={liveMonth.href} className="font-medium text-foreground underline">
                  Open {liveMonth.label}
                </Link>
              </>
            ) : null}
          </p>
        )}
      </div>

      <div className="space-y-1.5 py-3">
        <SnapshotLabel>Month projection</SnapshotLabel>
        <dl className="space-y-1 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Income still expected</dt>
            <dd className="tabular-nums font-medium">{formatMoney(planning.incomeStillExpected)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Bills still outstanding</dt>
            <dd className="tabular-nums font-medium">{formatMoney(planning.billsStillOutstanding)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Projected discretionary</dt>
            <dd
              className={cn(
                "tabular-nums font-semibold",
                planning.projectedDiscretionary < 0 && "text-rose-700 dark:text-rose-300"
              )}
            >
              {formatMoney(planning.projectedDiscretionary)}
            </dd>
          </div>
        </dl>
        <p className="text-[11px] text-muted-foreground">
          {formatMoney(planning.recognizedIncome)} known income − {formatMoney(planning.knownObligations)}{" "}
          in bills. Each paycheck counts once.
        </p>
      </div>
    </section>
  );
}
