"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { resolveLedgerView, type LedgerView } from "@/lib/dashboard-bills";
import { cn } from "@/lib/utils";

const VIEWS: { id: LedgerView; label: string }[] = [
  { id: "now", label: "Now" },
  { id: "plan", label: "Plan" },
  { id: "history", label: "History" },
];

export function ViewSwitcher({ operational }: { operational: boolean }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const current = resolveLedgerView(params.get("view"), operational);

  function open(view: LedgerView) {
    const next = new URLSearchParams(params.toString());
    if (view === "now" && operational) next.delete("view");
    else next.set("view", view);
    const query = next.toString();
    // A tab is a local dashboard view, not a server navigation.
    // Next.js syncs native History API updates with useSearchParams.
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div role="tablist" aria-label="Ledger views" className="grid w-full grid-cols-3 rounded-md border border-border p-0.5 lg:w-auto">
      {VIEWS.map((view) => {
        const selected = current === view.id;
        return (
          <button
            key={view.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => open(view.id)}
            className={cn(
              "h-10 rounded-sm text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-7 lg:px-3",
              selected ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {view.label}
          </button>
        );
      })}
    </div>
  );
}
