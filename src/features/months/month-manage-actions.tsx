"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { labelForMonthKey } from "@/lib/month-dates";
import { deleteMonth, retargetMonth } from "./actions";

type DialogMode = "change" | "delete" | null;

export function MonthManageActions({
  monthKey,
  label,
  variant,
}: {
  monthKey: string;
  label: string;
  variant: "header" | "card";
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [targetMonthKey, setTargetMonthKey] = useState(monthKey);
  const [busy, setBusy] = useState(false);

  function openChange() {
    setTargetMonthKey(monthKey);
    setDialog("change");
  }

  async function handleChange() {
    setBusy(true);
    try {
      const result = await retargetMonth(monthKey, targetMonthKey.trim());
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Moved to ${labelForMonthKey(result.monthKey)}`);
      setDialog(null);
      router.push(`/months/${result.monthKey}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      const result = await deleteMonth(monthKey);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Deleted ${label}`);
      setDialog(null);
      router.push("/months");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const previewLabel = /^\d{4}-(0[1-9]|1[0-2])$/.test(targetMonthKey.trim())
    ? labelForMonthKey(targetMonthKey.trim())
    : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          type="button"
          className={
            variant === "header"
              ? cn(buttonVariants({ variant: "outline", size: "sm" }), "whitespace-nowrap")
              : cn(buttonVariants({ variant: "outline", size: "icon-sm" }), "shrink-0")
          }
          aria-label={variant === "header" ? "Manage month" : `Manage ${label}`}
        >
          {variant === "header" ? (
            "Manage"
          ) : (
            <MoreVertical className="size-4" aria-hidden />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={openChange}>Change month</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDialog("delete")}>
            Delete month
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === "change"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-md" showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>Change month</DialogTitle>
            <DialogDescription>
              Move {label} to a different calendar month. Bill due dates and income dates shift
              to the same day in the new month (clamped to month end).
            </DialogDescription>
          </DialogHeader>
          <form
            className="contents"
            onSubmit={(e) => {
              e.preventDefault();
              if (!busy) void handleChange();
            }}
          >
          <div className="space-y-2">
            <Label htmlFor={`target-month-${monthKey}`}>New month (YYYY-MM)</Label>
            <Input
              id={`target-month-${monthKey}`}
              type="month"
              value={targetMonthKey}
              onChange={(e) => setTargetMonthKey(e.target.value)}
              disabled={busy}
            />
            {previewLabel && previewLabel !== label && (
              <p className="text-sm text-muted-foreground">Will become {previewLabel}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "delete"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-md" showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>Delete {label}?</DialogTitle>
            <DialogDescription>
              This permanently removes the month and every bill and income line in it. This cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={handleDelete}>
              {busy ? "Deleting…" : "Delete month"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
