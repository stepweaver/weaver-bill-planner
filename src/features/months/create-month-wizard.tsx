"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getPropagationDraft, getDraftFromTemplates, createMonthFromPropagation } from "./actions";
import { toast } from "sonner";
import { addMonths, format, parseISO } from "date-fns";

type MonthOption = { id: number; monthKey: string; label: string };

type DraftBill = {
  templateId: number | null;
  name: string;
  dueDate: string | null;
  plannedAmount: number | null;
  paymentUrl: string | null;
  isRecurring: boolean;
};

type DraftIncome = {
  name: string;
  expectedDate: string;
  expectedAmount: number | null;
};

type Draft = {
  targetMonthKey: string;
  label: string;
  billInstances: DraftBill[];
  incomeEvents: DraftIncome[];
};

function validIncomeRows(d: Draft): DraftIncome[] {
  return d.incomeEvents.filter((e) => e.name?.trim() && e.expectedDate);
}

function getDraftExceptions(d: Draft): string[] {
  const messages: string[] = [];
  if (validIncomeRows(d).length === 0) {
    messages.push(
      "No income with both a name and date. Paycheck windows (and auto-assignment) work best after you add at least one."
    );
  }
  for (const b of d.billInstances) {
    if (!b.dueDate) {
      messages.push(`"${b.name}" has no due date — it will stay unassigned until you set one.`);
    }
    if (b.plannedAmount == null || b.plannedAmount <= 0) {
      messages.push(`"${b.name}" has no planned amount — set an estimate when you can.`);
    }
  }
  return messages;
}

export function CreateMonthWizard({
  monthsList,
  defaultFromKey,
}: {
  monthsList: MonthOption[];
  defaultFromKey?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"choose" | "review">("choose");
  const [sourceMonthId, setSourceMonthId] = useState<string>(
    () => monthsList.find((m) => m.monthKey === defaultFromKey)?.id.toString() ?? monthsList[0]?.id.toString() ?? ""
  );
  const [targetMonthKey, setTargetMonthKey] = useState(() => {
    const next = defaultFromKey
      ? addMonths(parseISO(`${defaultFromKey}-01`), 1)
      : addMonths(new Date(), 1);
    return format(next, "yyyy-MM");
  });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(false);
  const [editAllRows, setEditAllRows] = useState(false);

  const exceptions = useMemo(
    () => (draft ? getDraftExceptions(draft) : []),
    [draft]
  );

  const hasExistingMonths = monthsList.length > 0;

  async function handleGetDraft() {
    if (!targetMonthKey.trim()) {
      toast.error("Enter target month (e.g. 2026-03)");
      return;
    }
    setLoading(true);
    try {
      const result = hasExistingMonths
        ? await getPropagationDraft(Number(sourceMonthId), targetMonthKey.trim())
        : await getDraftFromTemplates(targetMonthKey.trim());
      if (!result) {
        toast.error(
          hasExistingMonths
            ? "Could not build draft"
            : "No active templates. Add at least one template first."
        );
        return;
      }
      setDraft(result);
      setEditAllRows(false);
      setStep("review");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!draft) return;
    setLoading(true);
    try {
      const result = await createMonthFromPropagation(draft);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Month created");
      router.push(`/months/${draft.targetMonthKey}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  function updateBill(index: number, field: keyof DraftBill, value: string | number | null) {
    if (!draft) return;
    const next = [...draft.billInstances];
    next[index] = { ...next[index], [field]: value };
    setDraft({ ...draft, billInstances: next });
  }

  function removeBill(index: number) {
    if (!draft) return;
    setDraft({
      ...draft,
      billInstances: draft.billInstances.filter((_, i) => i !== index),
    });
  }

  function addIncome() {
    if (!draft) return;
    setDraft({
      ...draft,
      incomeEvents: [
        ...draft.incomeEvents,
        { name: "", expectedDate: `${draft.targetMonthKey}-01`, expectedAmount: null },
      ],
    });
  }

  function updateIncome(index: number, field: keyof DraftIncome, value: string | number | null) {
    if (!draft) return;
    const next = [...draft.incomeEvents];
    next[index] = { ...next[index], [field]: value };
    setDraft({ ...draft, incomeEvents: next });
  }

  function removeIncome(index: number) {
    if (!draft) return;
    setDraft({
      ...draft,
      incomeEvents: draft.incomeEvents.filter((_, i) => i !== index),
    });
  }

  if (step === "choose") {
    return (
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-lg">
            {hasExistingMonths ? "Source and target" : "Create your first month"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasExistingMonths && (
            <div className="space-y-2">
              <Label>Source month</Label>
              <Select value={sourceMonthId} onValueChange={(v) => setSourceMonthId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {monthsList.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {!hasExistingMonths && (
            <p className="text-sm text-muted-foreground">
              We’ll build a draft from your active bill templates, using each template’s due day to set dates in the target month.
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="targetMonthKey">Target month (YYYY-MM)</Label>
            <Input
              id="targetMonthKey"
              type="text"
              placeholder="2026-03"
              value={targetMonthKey}
              onChange={(e) => setTargetMonthKey(e.target.value)}
            />
          </div>
          <Button onClick={handleGetDraft} disabled={loading}>
            {loading ? "Building draft…" : hasExistingMonths ? "Review draft" : "Build draft from templates"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!draft) return null;

  const incomeReady = validIncomeRows(draft).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium">
          Roll forward: {draft.label} ({draft.targetMonthKey})
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setStep("choose")}>
            Back
          </Button>
          <Button size="sm" onClick={handleSave} disabled={loading}>
            {loading ? "Saving…" : "Save month"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick check</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {draft.billInstances.length} bills · {incomeReady} income line
            {incomeReady !== 1 ? "s" : ""} ready (name + date) · {draft.incomeEvents.length} total income
            rows
          </p>
          {exceptions.length === 0 ? (
            <p className="text-sm text-green-700 dark:text-green-400">
              No common issues flagged. You can save now and adjust in the month workspace.
            </p>
          ) : (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
              <p className="text-xs font-medium text-amber-950 dark:text-amber-100 uppercase tracking-wider">
                Exceptions ({exceptions.length})
              </p>
              <ul className="mt-2 list-disc pl-5 text-sm text-foreground space-y-1">
                {exceptions.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditAllRows((v) => !v)}
          >
            {editAllRows ? "Hide" : "Show"} full row editor
          </Button>
          {!editAllRows && (
            <p className="text-xs text-muted-foreground">
              Save anytime; recurring structure copies forward and auto-assignment runs after save when
              due dates and income line up.
            </p>
          )}
        </CardContent>
      </Card>

      {editAllRows && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bills ({draft.billInstances.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {draft.billInstances.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recurring bills to copy.</p>
              ) : (
                <div className="space-y-3">
                  {draft.billInstances.map((b, i) => (
                    <div
                      key={i}
                      className="flex flex-wrap items-center gap-2 rounded border p-2 text-sm"
                    >
                      <Input
                        className="w-32 font-medium"
                        value={b.name}
                        onChange={(e) => updateBill(i, "name", e.target.value)}
                      />
                      <Input
                        type="date"
                        className="w-36"
                        value={b.dueDate ?? ""}
                        onChange={(e) => updateBill(i, "dueDate", e.target.value || null)}
                      />
                      <Input
                        type="number"
                        step="0.01"
                        className="w-24"
                        placeholder="Amount"
                        value={b.plannedAmount ?? ""}
                        onChange={(e) =>
                          updateBill(
                            i,
                            "plannedAmount",
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => removeBill(i)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Income ({draft.incomeEvents.length})</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addIncome}>
                Add income
              </Button>
            </CardHeader>
            <CardContent>
              {draft.incomeEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No income yet. Add paychecks to define funding windows for the new month.
                </p>
              ) : (
                <div className="space-y-3">
                  {draft.incomeEvents.map((e, i) => (
                    <div
                      key={i}
                      className="flex flex-wrap items-center gap-2 rounded border p-2 text-sm"
                    >
                      <Input
                        className="w-32 font-medium"
                        placeholder="Name"
                        value={e.name}
                        onChange={(ev) => updateIncome(i, "name", ev.target.value)}
                      />
                      <Input
                        type="date"
                        className="w-36"
                        value={e.expectedDate}
                        onChange={(ev) => updateIncome(i, "expectedDate", ev.target.value)}
                      />
                      <Input
                        type="number"
                        step="0.01"
                        className="w-24"
                        placeholder="Amount"
                        value={e.expectedAmount ?? ""}
                        onChange={(ev) =>
                          updateIncome(
                            i,
                            "expectedAmount",
                            ev.target.value ? Number(ev.target.value) : null
                          )
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => removeIncome(i)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
