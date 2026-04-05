import type { MonthAttention } from "@/lib/month-funding";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function MonthAttentionStrip({ attention }: { attention: MonthAttention }) {
  const items: { key: string; label: string; count: number; href?: string; className: string }[] =
    [];

  if (attention.overdueIds.length > 0) {
    items.push({
      key: "overdue",
      label: "Overdue",
      count: attention.overdueIds.length,
      href: `#bill-row-${attention.overdueIds[0]}`,
      className:
        "border-rose-500/40 bg-rose-500/10 text-rose-900 dark:text-rose-100 hover:bg-rose-500/15",
    });
  }
  if (attention.dueSoonIds.length > 0) {
    items.push({
      key: "soon",
      label: "Due soon",
      count: attention.dueSoonIds.length,
      href: `#bill-row-${attention.dueSoonIds[0]}`,
      className:
        "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100 hover:bg-amber-500/15",
    });
  }
  if (attention.unassignedIds.length > 0) {
    items.push({
      key: "unassigned",
      label: "Unassigned",
      count: attention.unassignedIds.length,
      href: `#bill-row-${attention.unassignedIds[0]}`,
      className:
        "border-muted-foreground/50 bg-muted/50 text-foreground hover:bg-muted/70",
    });
  }
  if (attention.missingAmountIds.length > 0) {
    items.push({
      key: "missing",
      label: "Missing amount",
      count: attention.missingAmountIds.length,
      href: `#bill-row-${attention.missingAmountIds[0]}`,
      className:
        "border-violet-500/40 bg-violet-500/10 text-violet-950 dark:text-violet-100 hover:bg-violet-500/15",
    });
  }
  if (attention.overCapacityWindowKeys.length > 0) {
    items.push({
      key: "over",
      label: "Paycheck over capacity",
      count: attention.overCapacityWindowKeys.length,
      className:
        "border-orange-500/40 bg-orange-500/10 text-orange-950 dark:text-orange-100",
    });
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground rounded-md border border-dashed px-3 py-2">
        Nothing urgent — scan the bill list below or add income to define paycheck windows.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider shrink-0">
        Attention
      </span>
      {items.map((item) =>
        item.href ? (
          <a key={item.key} href={item.href} className="scroll-mt-24">
            <Badge
              variant="outline"
              className={cn("cursor-pointer font-normal tabular-nums", item.className)}
            >
              {item.label}: {item.count}
            </Badge>
          </a>
        ) : (
          <Badge
            key={item.key}
            variant="outline"
            className={cn("font-normal tabular-nums", item.className)}
          >
            {item.label}: {item.count}
          </Badge>
        )
      )}
    </div>
  );
}
