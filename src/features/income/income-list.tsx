"use client";

import { IncomeRow } from "./income-row";
import {
  colorKeysByIncomeEventId,
  type PaycheckWindow,
} from "@/lib/paycheck-windows";

type IncomeEvent = {
  id: number;
  name: string;
  expectedDate: string;
  expectedAmount: number | null;
  actualAmount: number | null;
  status: string;
  notes: string | null;
};

export function IncomeList({
  events,
  monthKey,
  windows = [],
}: {
  events: IncomeEvent[];
  monthKey: string;
  windows?: PaycheckWindow[];
}) {
  const colorByEventId = colorKeysByIncomeEventId(events, windows);

  return (
    <div className="min-w-0 rounded border">
      {events.length === 0 ? (
        <p className="px-3 py-4 text-center text-sm text-muted-foreground">
          No income. Add one to define paycheck windows.
        </p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {events.map((ev) => (
            <IncomeRow
              key={ev.id}
              event={ev}
              monthKey={monthKey}
              as="list"
              colorKey={colorByEventId.get(ev.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
