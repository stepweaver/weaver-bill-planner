import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  billDisplayGroup,
  clearsActiveFloat,
  isActivelyFloated,
  isBillOverdue,
  isBillPaid,
  mergeBillRecords,
  orderBillsForPlan,
} from "./bill-utils";
import { buildPaymentPlan, type PaydayEvent, type PlanBill } from "./payment-plan";

const TODAY = "2026-10-28";

function bill(overrides: Partial<PlanBill> & Pick<PlanBill, "id" | "name">): PlanBill {
  return {
    dueDate: "2026-10-20",
    plannedAmount: 10,
    invoiceAmount: null,
    amountPaid: null,
    status: "scheduled",
    floatTargetDate: null,
    ...overrides,
  };
}

describe("payment status", () => {
  it("does not treat a pending bill as cleared when amountPaid matches the invoice", () => {
    assert.equal(isBillPaid("pending", 80, 80), false);
    assert.equal(isBillPaid("pending", 80, 50), false);
    assert.equal(isBillPaid("paid", 80, 80), true);
    assert.equal(isBillPaid("skipped", 80, 80), false);
    assert.equal(isBillPaid("scheduled", 80, 80), true);
    assert.equal(isBillPaid("scheduled", 10, 80), false);
  });

  it("does not call a pending bill overdue", () => {
    assert.equal(isBillOverdue("2026-10-01", "pending", 80, 80, TODAY), false);
    assert.equal(isBillOverdue("2026-10-01", "scheduled", null, 80, TODAY), true);
    assert.equal(isBillOverdue("2026-10-28", "scheduled", null, 80, TODAY), false);
  });

  it("clears float only when a bill is marked pending or paid", () => {
    assert.equal(clearsActiveFloat("pending"), true);
    assert.equal(clearsActiveFloat("paid"), true);
    assert.equal(clearsActiveFloat("scheduled"), false);
    assert.equal(clearsActiveFloat("skipped"), false);
  });
});

describe("float", () => {
  it("keeps the bill unpaid and active until the target date arrives", () => {
    const floated = bill({
      id: 1,
      name: "Rent",
      dueDate: "2026-10-15",
      floatTargetDate: "2026-11-06",
    });
    assert.equal(isActivelyFloated(floated, TODAY), true);
    assert.equal(floated.dueDate, "2026-10-15");
    assert.equal(floated.status, "scheduled");
    assert.equal(billDisplayGroup(floated, TODAY), "floated");
  });

  it("resurfaces on the float target date without changing the original due date", () => {
    const expired = bill({
      id: 2,
      name: "Internet",
      dueDate: "2026-10-15",
      floatTargetDate: TODAY,
    });
    assert.equal(isActivelyFloated(expired, TODAY), false);
    assert.equal(expired.dueDate, "2026-10-15");
    assert.equal(billDisplayGroup(expired, TODAY), "overdue");
  });

  it("stops being floated once the bill is pending, even if the target date remains", () => {
    const pending = bill({
      id: 3,
      name: "Power",
      status: "pending",
      floatTargetDate: "2026-11-06",
      amountPaid: 40,
    });
    assert.equal(isActivelyFloated(pending, TODAY), false);
    assert.equal(billDisplayGroup(pending, TODAY), "pending");
  });
});

describe("selection math", () => {
  const paydays: PaydayEvent[] = [
    { name: "Paycheck", expectedDate: "2026-11-06", status: "expected" },
  ];

  it("subtracts pending and selected scheduled bills in exact cents", () => {
    const plan = buildPaymentPlan({
      todayIso: TODAY,
      availableBalance: 100,
      paydayEvents: paydays,
      bills: [
        bill({ id: 1, name: "Pending", status: "pending", amountPaid: 33.33, dueDate: "2026-10-01" }),
        bill({ id: 2, name: "Selected", dueDate: "2026-10-30", plannedAmount: 33.33 }),
        bill({ id: 3, name: "Later", dueDate: "2026-11-10", plannedAmount: 10 }),
      ],
    });
    assert.deepEqual(plan.defaultSelectedIds, [2]);
    assert.equal(plan.pendingCents, 3333);
    assert.equal(plan.selectedCents, 3333);
    assert.equal(plan.leftAfterSelectedCents, 10000 - 3333 - 3333);
    assert.equal(plan.leftAfterSelected, 33.34);
  });

  it("keeps pending in the total when the what-if selection omits them", () => {
    const plan = buildPaymentPlan({
      todayIso: TODAY,
      availableBalance: 50,
      paydayEvents: paydays,
      selectedIds: [],
      bills: [
        bill({ id: 1, name: "Sent", status: "pending", amountPaid: 20.1, dueDate: "2026-10-02" }),
        bill({ id: 2, name: "Due", dueDate: "2026-10-29", plannedAmount: 15.2 }),
      ],
    });
    assert.deepEqual(plan.selectedIds, []);
    assert.equal(plan.pendingCents, 2010);
    assert.equal(plan.selectedCents, 0);
    assert.equal(plan.leftAfterSelectedCents, 5000 - 2010);
  });

  it("does not subtract paid bills that have already cleared", () => {
    const plan = buildPaymentPlan({
      todayIso: TODAY,
      availableBalance: 80.5,
      paydayEvents: paydays,
      bills: [
        bill({ id: 1, name: "Cleared", status: "paid", amountPaid: 40, dueDate: "2026-10-01" }),
        bill({ id: 2, name: "Skipped", status: "skipped", plannedAmount: 25, dueDate: "2026-10-03" }),
        bill({ id: 3, name: "Open", dueDate: "2026-10-27", plannedAmount: 10.25 }),
      ],
    });
    assert.deepEqual(plan.selectedIds, [3]);
    assert.equal(plan.pendingCents, 0);
    assert.equal(plan.selectedCents, 1025);
    assert.equal(plan.leftAfterSelectedCents, 8050 - 1025);
  });

  it("uses the remainder of a partial scheduled payment and the sent amount for pending", () => {
    const plan = buildPaymentPlan({
      todayIso: TODAY,
      availableBalance: 0,
      paydayEvents: [],
      bills: [
        bill({
          id: 1,
          name: "Partial",
          dueDate: "2026-10-28",
          plannedAmount: 100,
          amountPaid: 40,
        }),
        bill({
          id: 2,
          name: "In flight",
          status: "pending",
          dueDate: "2026-10-01",
          invoiceAmount: 90,
          amountPaid: 25.5,
        }),
      ],
    });
    assert.equal(plan.selectable[0]?.amountCents, 6000);
    assert.equal(plan.pending[0]?.amountCents, 2550);
    assert.equal(plan.leftAfterSelectedCents, -6000 - 2550);
  });

  it("defaults to bills due before the next income event and leaves later bills unchecked", () => {
    const plan = buildPaymentPlan({
      todayIso: TODAY,
      availableBalance: 500,
      paydayEvents: [
        { name: "This month", expectedDate: "2026-10-28", status: "expected" },
        { name: "November", expectedDate: "2026-11-13", status: "expected" },
        { name: "Already paid", expectedDate: "2026-11-01", status: "received" },
      ],
      bills: [
        bill({ id: 1, name: "Overdue", dueDate: "2026-10-20", plannedAmount: 5 }),
        bill({ id: 2, name: "On payday", dueDate: "2026-10-28", plannedAmount: 5 }),
        bill({ id: 3, name: "Before next", dueDate: "2026-11-12", plannedAmount: 5 }),
        bill({ id: 4, name: "After next", dueDate: "2026-11-13", plannedAmount: 5 }),
      ],
    });
    assert.equal(plan.nextIncomeDate, "2026-10-28");
    assert.deepEqual(plan.nextPayday, { date: "2026-11-13", name: "November" });
    assert.deepEqual(plan.defaultSelectedIds, [1]);
    const chosen = buildPaymentPlan({
      todayIso: TODAY,
      availableBalance: 500,
      paydayEvents: plan.nextPayday
        ? [{ name: plan.nextPayday.name, expectedDate: plan.nextPayday.date, status: "expected" }]
        : [],
      bills: [
        bill({ id: 4, name: "After next", dueDate: "2026-11-01", plannedAmount: 5 }),
      ],
      selectedIds: [4],
    });
    assert.deepEqual(chosen.selectedIds, [4]);
    assert.equal(chosen.selectedCents, 500);
  });

  it("selects overdue and due-today bills when no future income is recorded", () => {
    const plan = buildPaymentPlan({
      todayIso: TODAY,
      availableBalance: null,
      paydayEvents: [{ name: "Old", expectedDate: "2026-10-01", status: "received" }],
      bills: [
        bill({ id: 1, name: "Late", dueDate: "2026-10-01", plannedAmount: 1 }),
        bill({ id: 2, name: "Today", dueDate: TODAY, plannedAmount: 1 }),
        bill({ id: 3, name: "Later", dueDate: "2026-11-02", plannedAmount: 1 }),
      ],
    });
    assert.equal(plan.hasFuturePayday, false);
    assert.equal(plan.nextPayday, null);
    assert.deepEqual(plan.defaultSelectedIds, [1, 2]);
    assert.equal(plan.leftAfterSelected, null);
  });

  it("excludes an active float and puts it back when the target date arrives", () => {
    const bills = [
      bill({
        id: 1,
        name: "Floated",
        dueDate: "2026-10-10",
        plannedAmount: 70,
        floatTargetDate: "2026-11-06",
      }),
      bill({ id: 2, name: "Due", dueDate: "2026-10-21", plannedAmount: 12 }),
    ];
    const active = buildPaymentPlan({
      todayIso: TODAY,
      availableBalance: 200,
      paydayEvents: paydays,
      bills,
    });
    assert.equal(active.floatedCount, 1);
    assert.deepEqual(active.selectable.map((line) => line.id), [2]);
    assert.equal(active.selectedCents, 1200);

    const expired = buildPaymentPlan({
      todayIso: "2026-11-06",
      availableBalance: 200,
      paydayEvents: [{ name: "Next", expectedDate: "2026-11-20", status: "expected" }],
      bills,
    });
    assert.equal(expired.floatedCount, 0);
    assert.deepEqual(expired.defaultSelectedIds, [1, 2]);
  });

  it("includes an unresolved prior-month bill once and does not invent a second record", () => {
    const october = bill({
      id: 9,
      name: "Carry",
      dueDate: "2026-09-18",
      plannedAmount: 44,
      ownerMonthKey: "2026-09",
    });
    const merged = mergeBillRecords(
      [bill({ id: 4, name: "After payday", dueDate: "2026-11-10", plannedAmount: 8, ownerMonthKey: "2026-10" })],
      [october, october]
    );
    assert.equal(merged.length, 2);
    assert.equal(merged[1], october);
    assert.equal(merged[1]?.dueDate, "2026-09-18");

    const plan = buildPaymentPlan({
      todayIso: TODAY,
      availableBalance: 100,
      paydayEvents: paydays,
      bills: merged,
    });
    assert.deepEqual(plan.defaultSelectedIds, [9]);
    assert.equal(plan.pending.length + plan.selectable.length, 2);
  });
});

describe("bill ordering", () => {
  it("orders overdue, upcoming, floated, pending, then paid and skipped by original due date", () => {
    const rows = [
      bill({ id: 7, name: "Skipped", status: "skipped", dueDate: "2026-10-01" }),
      bill({ id: 6, name: "Paid later", status: "paid", dueDate: "2026-10-05" }),
      bill({ id: 5, name: "Paid earlier", status: "paid", dueDate: "2026-09-01" }),
      bill({ id: 4, name: "Pending later", status: "pending", dueDate: "2026-10-20" }),
      bill({ id: 3, name: "Pending earlier", status: "pending", dueDate: "2026-10-02" }),
      bill({
        id: 8,
        name: "Floated later",
        dueDate: "2026-10-18",
        floatTargetDate: "2026-11-06",
      }),
      bill({
        id: 2,
        name: "Floated earlier",
        dueDate: "2026-10-08",
        floatTargetDate: "2026-11-06",
      }),
      bill({ id: 10, name: "Upcoming later", dueDate: "2026-11-03" }),
      bill({ id: 9, name: "Upcoming earlier", dueDate: "2026-10-30" }),
      bill({ id: 12, name: "Due today later id", dueDate: TODAY }),
      bill({ id: 1, name: "Overdue", dueDate: "2026-10-01" }),
      bill({ id: 11, name: "Due today", dueDate: TODAY }),
    ];
    const ordered = orderBillsForPlan(rows, TODAY).map((row) => row.id);
    assert.deepEqual(ordered, [1, 11, 12, 9, 10, 2, 8, 3, 4, 5, 7, 6]);
    assert.deepEqual(
      orderBillsForPlan(rows, TODAY).map((row) => billDisplayGroup(row, TODAY)),
      [
        "overdue",
        "overdue",
        "overdue",
        "upcoming",
        "upcoming",
        "floated",
        "floated",
        "pending",
        "pending",
        "settled",
        "settled",
        "settled",
      ]
    );
  });
});
