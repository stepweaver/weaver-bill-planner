import type { ColorKey } from "@/lib/paycheck-windows";

/** Left border accent for a table/list row */
export function paycheckRowBorderClass(colorKey: ColorKey | string | null | undefined): string {
  switch (colorKey) {
    case "rose":
      return "border-l-[3px] border-l-rose-500";
    case "blue":
      return "border-l-[3px] border-l-blue-500";
    case "amber":
      return "border-l-[3px] border-l-amber-500";
    case "green":
      return "border-l-[3px] border-l-green-500";
    case "violet":
      return "border-l-[3px] border-l-violet-500";
    case "slate":
    default:
      return "border-l-[3px] border-l-slate-500";
  }
}

export function paycheckBadgeClass(colorKey: ColorKey | string | null | undefined): string {
  switch (colorKey) {
    case "rose":
      return "bg-rose-500/15 text-rose-800 dark:text-rose-200";
    case "blue":
      return "bg-blue-500/15 text-blue-800 dark:text-blue-200";
    case "amber":
      return "bg-amber-500/15 text-amber-900 dark:text-amber-200";
    case "green":
      return "bg-green-500/15 text-green-800 dark:text-green-200";
    case "violet":
      return "bg-violet-500/15 text-violet-800 dark:text-violet-200";
    case "slate":
    default:
      return "bg-slate-500/15 text-slate-800 dark:text-slate-200";
  }
}
