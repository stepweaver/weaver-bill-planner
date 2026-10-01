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
              {line.status ? (
                <span className="text-muted-foreground">
                  {line.status === "pending" ? "Pending" : "Due"} ·{" "}
                </span>
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
  updatedAt,
}: {
  monthKey: string;
  balance: number | null;
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
            (balance ?? 0) < 0 && "text-rose-700 dark:text-rose-300"
          )}
        >
          {formatMoney(balance ?? 0)}
        </button>
      )}
      <p className="text-[11px] text-muted-foreground">
        {showEditor ? (
          "What your bank shows right now."
        ) : updatedAt ? (
          <time dateTime={updatedAt} suppressHydrationWarning>
            Updated {format(new Date(updatedAt), "MMM d, h:mm a")}
          </time>
        ) : (
          "What your bank shows right now."
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
  const left = planning.leftAfterBills;
  const short = left != null && left < 0;
  const covered = left != null && left >= 0;

  return (
    <section aria-label="Planning snapshot" className="border-y border-border">
      <div className="space-y-3 py-3">
        {operational ? (
          <>
            <AvailableBalanceControl
              monthKey={monthKey}
              balance={availableBalance}
              updatedAt={availableBalanceUpdatedAt}
            />

            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <SnapshotLabel>Left after due and pending</SnapshotLabel>
                {left != null ? (
                  <p
                    className={cn(
                      "text-right text-xl font-semibold tabular-nums tracking-tight",
                      short && "text-rose-700 dark:text-rose-300"
                    )}
                  >
                    {formatMoney(left)}
                  </p>
                ) : (
                  <p className="text-right text-xs text-muted-foreground">Enter the bank balance</p>
                )}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {left == null
                  ? `Due and pending bills total ${formatMoney(planning.stillToCoverTotal)}.`
                  : planning.stillToCover.length === 0
                    ? "Nothing is due or pending."
                    : short
                      ? `Short ${formatMoney(Math.abs(left))}. Float a bill to the next pay period.`
                      : "Covered."}
              </p>
              {covered && planning.stillToCover.length > 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  Bank balance minus {formatMoney(planning.stillToCoverTotal)} still due or pending.
                </p>
              ) : null}
              {planning.stillToCover.length > 0 ? <BillLines lines={planning.stillToCover} /> : null}
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
    </section>
  );
}
