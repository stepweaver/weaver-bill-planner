"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acknowledgePayday } from "./payday-actions";

export function PaydayAcknowledgment({ acknowledged }: { acknowledged: boolean }) {
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  if (acknowledged) {
    return <p className="text-sm text-muted-foreground">Payday plan acknowledged for today.</p>;
  }

  async function handleClick() {
    setSaving(true);
    try {
      const result = await acknowledgePayday();
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Payday plan acknowledged. No more payday reminders today.");
        router.refresh();
      }
    } catch {
      toast.error("Couldn't save payday acknowledgment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={() => void handleClick()}>
      {saving ? "Saving..." : "Payday planned"}
    </Button>
  );
}
