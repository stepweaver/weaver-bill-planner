"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createIncome, updateIncome } from "./actions";

type Initial = {
  id: number;
  name: string;
  expectedDate: string;
  actualAmount: number | null;
  status: string;
  notes: string | null;
};

export function IncomeForm({
  monthId,
  monthKey,
  initial,
  onSuccess,
}: {
  monthId?: number;
  monthKey: string;
  initial?: Initial;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [date, setDate] = useState(initial?.expectedDate ?? "");
  const [amount, setAmount] = useState(initial?.actualAmount == null ? "" : String(initial.actualAmount));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const scheduled = initial?.status === "expected" && amount.trim() === "";

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const formData = new FormData();
    formData.set("name", name);
    formData.set("expectedDate", date);
    formData.set("actualAmount", amount);
    formData.set("notes", notes);
    try {
      const result = initial
        ? await updateIncome(initial.id, monthKey, formData)
        : monthId != null
          ? await createIncome(monthId, monthKey, formData)
          : { error: { form: ["Month not found."] } };
      if ("error" in result && result.error) {
        Object.values(result.error).flat().forEach((message) => toast.error(message));
        return;
      }
      toast.success(initial ? "Income updated" : "Income added");
      router.refresh();
      onSuccess?.();
    } catch {
      toast.error("Couldn't save income. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label htmlFor="income-name">Source</Label>
        <Input id="income-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="USPS" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="income-date">{scheduled ? "Scheduled payday" : "Date received"}</Label>
        <Input id="income-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="income-amount">Amount received</Label>
        <Input id="income-amount" type="number" min="0.01" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={scheduled ? "Enter when deposited" : "0.00"} required={!scheduled} />
        {scheduled && <p className="text-xs text-muted-foreground">Leave blank until this paycheck arrives. Its scheduled date still drives reminders.</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="income-notes">Note (optional)</Label>
        <Textarea id="income-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      <Button type="submit" disabled={saving}>{saving ? "Saving..." : initial ? "Save changes" : "Add income"}</Button>
    </form>
  );
}
