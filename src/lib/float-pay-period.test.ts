import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { suggestNextFloatPayPeriod, type FloatPaydayEvent } from "./float-pay-period";

const paydays: FloatPaydayEvent[] = [
  { name: "USPS", expectedDate: "2026-11-06", status: "received" },
  { name: "PHM", expectedDate: "2026-11-13", status: "received" },
  { name: "USPS", expectedDate: "2026-11-20", status: "received" },
  { name: "PHM", expectedDate: "2026-11-27", status: "expected" },
];
const pick = (dueDate: string, events: FloatPaydayEvent[] = paydays) =>
  suggestNextFloatPayPeriod({ todayIso: "2026-11-20", dueDate, paydayEvents: events });

describe("next paycheck period float target", () => {
  it("moves an overdue carryover from the current period to the next payday", () => {
    assert.deepEqual(pick("2026-10-29"), { date: "2026-11-27", estimated: false });
  });
  it("moves Nov 29's bill beyond the Nov 27 period covering it", () => {
    assert.deepEqual(pick("2026-11-29"), { date: "2026-12-04", estimated: true });
  });
  it("does not skip a period when a bill is due before the next payday", () => {
    assert.deepEqual(pick("2026-11-25"), { date: "2026-11-27", estimated: false });
  });
  it("can infer the next period across a month boundary not yet set up", () => {
    assert.deepEqual(pick("2026-12-10"), { date: "2026-12-11", estimated: true });
  });
  it("prefers a recorded payday over an inferred one", () => {
    assert.deepEqual(pick("2026-11-29", [
      ...paydays,
      { name: "USPS", expectedDate: "2026-12-04", status: "expected" },
    ]), { date: "2026-12-04", estimated: false });
  });
  it("does not make up a payday from a single entry", () => {
    assert.equal(pick("2026-11-29", [
      { name: "USPS", expectedDate: "2026-11-20", status: "received" },
    ]), null);
  });
  it("does not infer a future payday from an irregular cadence", () => {
    assert.equal(pick("2026-11-29", [
      { name: "USPS", expectedDate: "2026-11-06", status: "received" },
      { name: "USPS", expectedDate: "2026-11-19", status: "received" },
    ]), null);
  });
  it("does not change any source objects or turn estimated income into records", () => {
    const before = JSON.stringify(paydays);
    pick("2026-11-29");
    assert.equal(JSON.stringify(paydays), before);
  });
});
