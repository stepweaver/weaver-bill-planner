"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateAvailableBankBalance } from "@/features/months/actions";
import { formatMoney } from "./format";

export function AvailableBalanceEditor({
  monthKey,
  balance,
  updatedAt,
  onClose,
}: {
  monthKey: string;
  balance: number | null;
  updatedAt: string | null;
  onClose?: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(balance == null ? "" : balance.toFixed(2));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
      toast.success("Bank balance saved");
      onClose?.();
      router.refresh();
    } catch {
      toast.error("Couldn't save the balance.");
    } finally {
      setSaving(false);
    }
  }

  return (
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
        aria-label="Entered bank balance"
        disabled={saving}
        className="h-10 min-w-0 flex-1 text-base tabular-nums"
      />
      <Button
        type="button"
        variant="outline"
        className="h-10 w-10 shrink-0 px-0"
        aria-label="Toggle negative amount"
        disabled={saving}
        onClick={toggleSign}
      >
        ±
      </Button>
      <Button type="submit" className="h-10 shrink-0 px-3" disabled={saving}>
        {saving ? "Saving" : "Save"}
      </Button>
      {onClose ? (
        <Button type="button" variant="ghost" className="h-10 shrink-0 px-2" disabled={saving} onClick={onClose}>
          Cancel
        </Button>
      ) : null}
      <p className="w-full text-[11px] text-muted-foreground">
        {updatedAt ? (
          <time dateTime={updatedAt} suppressHydrationWarning>
            Last saved {format(new Date(updatedAt), "MMM d, h:mm a")}.{" "}
          </time>
        ) : null}
        Enter the balance before pending withdrawals. Those are subtracted below.
      </p>
    </form>
  );
}

export function formatBankBalance(balance: number | null) {
  if (balance == null) return "Enter balance";
  return formatMoney(balance);
}
