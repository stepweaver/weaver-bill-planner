import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addLedgerDays, daysUntilLedgerDate } from "./ledger-date-math";
import { isPriorityCarryover, orderNowBills, type PriorityBill } from "./bill-priority";

const today = "2026-11-19";
const bill = (id: number, dueDate: string, ownerMonthKey = "2026-11", status = "scheduled", floatTargetDate: string | null = null): PriorityBill =>
  ({ id, dueDate, ownerMonthKey, status, floatTargetDate });

describe("overdue carryover urgency", () => {
  it("puts overdue unpaid prior-month obligations before newer bills", () => {
    const rows = [
      bill(1, "2026-11-29"),
      bill(2, "2026-10-29", "2026-10"),
      bill(3, "2026-11-18"),
      bill(4, "2026-11-19"),
      bill(5, "2026-10-01", "2026-10", "pending"),
    ];
    assert.deepEqual(orderNowBills(rows, today, "2026-11").map((row) => row.id), [2, 3, 4, 1, 5]);
    assert.equal(isPriorityCarryover(rows[1]!, today, "2026-11"), true);
    assert.equal(isPriorityCarryover(rows[4]!, today, "2026-11"), false);
    assert.deepEqual(rows.map((row) => row.id), [1, 2, 3, 4, 5]);
  });

  it("does not escalate a future carryover or a deliberately floated obligation", () => {
    assert.equal(isPriorityCarryover(bill(1, "2026-11-25", "2026-10"), today, "2026-11"), false);
    assert.equal(isPriorityCarryover(bill(2, "2026-10-25", "2026-10", "scheduled", "2026-11-27"), today, "2026-11"), false);
    assert.equal(isPriorityCarryover(bill(3, "2026-10-25", "2026-10", "paid"), today, "2026-11"), false);
  });

  it("uses calendar days across daylight-saving changes and month boundaries", () => {
    assert.equal(daysUntilLedgerDate("2026-10-29", today), -21);
    assert.equal(addLedgerDays("2026-10-31", 2), "2026-11-02");
    assert.equal(daysUntilLedgerDate("2026-03-09", "2026-03-07"), 2);
    assert.equal(daysUntilLedgerDate("2026-02-30", today), null);
  });
  it("keeps every overdue carryover together ahead of current-month debt", () => {
    const rows = [
      bill(1, "2026-11-18"),
      bill(2, "2026-10-29", "2026-10"),
      bill(3, "2026-09-16", "2026-09"),
      bill(4, "2026-11-25"),
      bill(5, "2026-10-01", "2026-10", "pending"),
    ];
    const result = orderNowBills(rows, today, "2026-11");
    const carryover = result.filter((item) => isPriorityCarryover(item, today, "2026-11"));
    assert.deepEqual(carryover.map((item) => item.id), [3, 2]);
    assert.deepEqual(result.slice(0, carryover.length).map((item) => item.id), [3, 2]);
    assert.deepEqual(result.map((item) => item.id), [3, 2, 1, 4, 5]);
  });

});
