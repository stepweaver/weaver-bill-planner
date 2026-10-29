"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateAvailableBankBalance } from "@/features/months/actions";
import { parseLocalIsoDate } from "@/lib/month-dates";
import type { PaydayEvent, PlanBill } from "@/lib/payment-plan";
import { buildPaymentPlan } from "@/lib/payment-plan";
import { centsToDollars } from "@/lib/money";
import { cn } from "@/lib/utils";

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatCents(cents: number) {
  return formatMoney(centsToDollars(cents));
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

function PlanCheckRow({
  id,
  name,
  dueDate,
  amountCents,
  checked,
  disabled,
  label,
  onCheckedChange,
}: {
  id: number;
  name: string;
  dueDate: string | null;
  amountCents: number;
  checked: boolean;
  disabled?: boolean;
  label: string;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <li className="flex min-h-11 items-center gap-3">
      <input
        type="checkbox"
        className="size-6 shrink-0 accent-primary"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onCheckedChange?.(event.target.checked)}
      />
      <a
        href={`#bill-row-${id}`}
        className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 text-sm hover:underline"
      >
        <span className="min-w-0 truncate">{name}</span>
        <span className="shrink-0 tabular-nums">
          {dueDate ? <span className="text-muted-foreground">{formatShortDate(dueDate)} · </span> : null}
          {formatCents(amountCents)}
        </span>
      </a>
    </li>
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

function planSignature(bills: PlanBill[], paydayEvents: PaydayEvent[], todayIso: string): string {
  return JSON.stringify({
    todayIso,
    paydayEvents,
    bills: bills.map((bill) => [
      bill.id,
      bill.status,
      bill.dueDate,
      bill.floatTargetDate,
      bill.plannedAmount,
      bill.invoiceAmount,
      bill.amountPaid,
    ]),
  });
}

export function PlanningSnapshot({
  monthKey,
  operational,
  liveMonth,
  availableBalance,
  availableBalanceUpdatedAt,
  bills,
  paydayEvents,
  todayIso,
}: {
  monthKey: string;
  operational: boolean;
  liveMonth: { href: string; label: string } | null;
  availableBalance: number | null;
  availableBalanceUpdatedAt: string | null;
  bills: PlanBill[];
  paydayEvents: PaydayEvent[];
  todayIso: string;
}) {
  const signature = useMemo(
    () => planSignature(bills, paydayEvents, todayIso),
    [bills, paydayEvents, todayIso]
  );
  const [seenSignature, setSeenSignature] = useState(signature);
  const [picked, setPicked] = useState<number[] | null>(null);
  if (seenSignature !== signature) {
    setSeenSignature(signature);
    setPicked(null);
  }

  const plan = buildPaymentPlan({
    bills,
    paydayEvents,
    availableBalance,
    todayIso,
    ...(picked === null ? {} : { selectedIds: picked }),
  });
  const selected = new Set(plan.selectedIds);
  const left = plan.leftAfterSelectedCents;
  const short = left != null && left < 0;

  function toggle(id: number, checked: boolean) {
    const current = plan.selectedIds;
    setPicked(checked ? [...current, id] : current.filter((selectedId) => selectedId !== id));
  }

  return (
    <section aria-label="Bill calculator" className="border-y border-border">
      <div className="space-y-3 py-3">
        {operational ? (
          <>
            <AvailableBalanceControl
              monthKey={monthKey}
              balance={availableBalance}
              updatedAt={availableBalanceUpdatedAt}
            />

            <div className="space-y-1 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground">Pending payments</span>
                <span className="tabular-nums">{formatCents(plan.pendingCents)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground">Selected bills</span>
                <span className="tabular-nums">{formatCents(plan.selectedCents)}</span>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 pt-1">
                <SnapshotLabel>Left after selected bills</SnapshotLabel>
                {left != null ? (
                  <p
                    className={cn(
                      "text-right text-xl font-semibold tabular-nums tracking-tight",
                      short && "text-rose-700 dark:text-rose-300"
                    )}
                  >
                    {formatCents(left)}
                  </p>
                ) : (
                  <p className="text-right text-xs text-muted-foreground">Enter the bank balance</p>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {left == null
                  ? "Enter what the bank shows. Pending withdrawals are subtracted separately."
                  : short
                    ? `Short ${formatCents(Math.abs(left))}. Float a bill or uncheck one you will not pay yet.`
                    : "Bank balance, minus pending withdrawals, minus the bills you checked."}
              </p>
              {!plan.hasFuturePayday ? (
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  No future payday is recorded, so payday alerts cannot run. Add the next paycheck below.
                </p>
              ) : null}
              {plan.floatedCount > 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  Floated bills stay out of this plan until their target date.
                </p>
              ) : null}
            </div>

            {plan.pending.length > 0 || plan.selectable.length > 0 ? (
              <ul>
                {plan.pending.map((line) => (
                  <PlanCheckRow
                    key={line.id}
                    id={line.id}
                    name={line.name}
                    dueDate={line.dueDate}
                    amountCents={line.amountCents}
                    checked
                    disabled
                    label={`${line.name} is pending and stays in the plan`}
                  />
                ))}
                {plan.selectable.map((line) => (
                  <PlanCheckRow
                    key={line.id}
                    id={line.id}
                    name={line.name}
                    dueDate={line.dueDate}
                    amountCents={line.amountCents}
                    checked={selected.has(line.id)}
                    label={`Include ${line.name} in this plan`}
                    onCheckedChange={(checked) => toggle(line.id, checked)}
                  />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No scheduled bills are waiting to be paid.</p>
            )}
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
