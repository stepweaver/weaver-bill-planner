import { IncomeRow } from "./income-row";

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
}: {
  events: IncomeEvent[];
  monthKey: string;
}) {
  return (
    <div className="min-w-0 rounded border">
      {events.length === 0 ? (
        <p className="px-2 py-3 text-center text-muted-foreground text-xs">
          No income. Add one to define paycheck windows.
        </p>
      ) : (
        <ul className="divide-y divide-border text-xs">
          {events.map((ev) => (
            <IncomeRow key={ev.id} event={ev} monthKey={monthKey} as="list" />
          ))}
        </ul>
      )}
    </div>
  );
}
