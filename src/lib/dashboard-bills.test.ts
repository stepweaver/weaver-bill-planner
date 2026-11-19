import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  groupPlanBills,
  isNowActionBill,
  nextPaydayCard,
  paycheckGroupMoney,
  projectGroupRemainder,
  resolveLedgerView,
  splitBillsForViews,
  sumObligationCents,
  type DashboardBillState,
} from "./dashboard-bills";
import { buildPaymentPlan, type PaydayEvent, type PlanBill } from "./payment-plan";

const TODAY = "2026-10-28";

function bill(overrides: Partial<PlanBill> & Pick<PlanBill, "id" | "name">): PlanBill & {
  displayWindowKey: string | null;
} {
  return {
    dueDate: "2026-10-20",
    plannedAmount: 10,
    invoiceAmount: null,
    amountPaid: null,
    status: "scheduled",
    floatTargetDate: null,
    displayWindowKey: null,
    ...overrides,
  };
}

function state(billRow: DashboardBillState): DashboardBillState {
  return billRow;
}

describe("ledger view", () => {
  it("opens the current month on Now and a past month on History", () => {
    assert.equal(resolveLedgerView(null, true), "now");
    assert.equal(resolveLedgerView(undefined, true), "now");
    assert.equal(resolveLedgerView("nope", true), "now");
    assert.equal(resolveLedgerView(null, false), "history");
    assert.equal(resolveLedgerView("plan", false), "plan");
    assert.equal(resolveLedgerView("now", false), "now");
  });
});

describe("dashboard bill buckets", () => {
  const rows = [
    bill({ id: 1, name: "Due", dueDate: "2026-10-21", plannedAmount: 12, displayWindowKey: "pre-1" }),
    bill({ id: 2, name: "Sent", status: "pending", amountPaid: 20, dueDate: "2026-10-02", displayWindowKey: "pre-1" }),
    bill({
      id: 3,
      name: "Floated",
      dueDate: "2026-10-15",
      plannedAmount: 70,
      floatTargetDate: "2026-11-06",
      displayWindowKey: "pre-1",
    }),
    bill({ id: 4, name: "Cleared", status: "paid", amountPaid: 40, dueDate: "2026-10-01" }),
    bill({ id: 5, name: "Skipped", status: "skipped", plannedAmount: 8, dueDate: "2026-10-03" }),
    bill({ id: 6, name: "Later", dueDate: "2026-11-20", plannedAmount: 15, displayWindowKey: "income-1" }),
  ];

  it("puts each open bill in one place and keeps paid bills for history", () => {
    const split = splitBillsForViews(rows, TODAY);
    assert.deepEqual(split.now.map((row) => row.id), [1, 2, 6]);
    assert.deepEqual(split.floated.map((row) => row.id), [3]);
    assert.deepEqual(split.history.map((row) => row.id), [4, 5]);
    assert.equal(isNowActionBill(rows[3]!, TODAY), false);
    assert.equal(rows[2]?.dueDate, "2026-10-15");
  });

  it("does not treat a covered scheduled bill as still actionable", () => {
    const covered = bill({
      id: 8,
      name: "Covered",
      status: "scheduled",
      plannedAmount: 30,
      amountPaid: 30,
    });
    assert.equal(isNowActionBill(covered, TODAY), false);
    assert.equal(splitBillsForViews([covered], TODAY).history.map((row) => row.id)[0], 8);
  });

  it("keeps recurring and one-time bills on the same payment rules", () => {
    const recurring = state(bill({ id: 1, name: "Rent" }));
    const once = state(bill({ id: 2, name: "Tag" }));
    assert.equal(isNowActionBill(recurring, TODAY), isNowActionBill(once, TODAY));
  });
});

describe("payment session projection", () => {
  const paydays: PaydayEvent[] = [
    { name: "Paycheck", expectedDate: "2026-11-06", status: "expected" },
  ];

  it("adjusts the projected remainder when a bill is selected and restores it when cleared", () => {
    const bills = [
      bill({ id: 1, name: "Power", dueDate: "2026-10-30", plannedAmount: 40 }),
      bill({ id: 2, name: "Water", dueDate: "2026-10-30", plannedAmount: 15 }),
    ];
    const base = buildPaymentPlan({
      todayIso: TODAY,
      availableBalance: 100,
      paydayEvents: paydays,
      bills,
      selectedIds: [],
    });
    const withPower = buildPaymentPlan({
      todayIso: TODAY,
      availableBalance: 100,
      paydayEvents: paydays,
      bills,
      selectedIds: [1],
    });
    const withBoth = buildPaymentPlan({
      todayIso: TODAY,
      availableBalance: 100,
      paydayEvents: paydays,
      bills,
      selectedIds: [1, 2],
    });
    assert.equal(base.leftAfterSelectedCents, 10000);
    assert.equal(withPower.leftAfterSelectedCents, 10000 - 4000);
    assert.equal(withBoth.leftAfterSelectedCents, 10000 - 4000 - 1500);
    const restored = buildPaymentPlan({
      todayIso: TODAY,
      availableBalance: 100,
      paydayEvents: paydays,
      bills,
      selectedIds: withBoth.selectedIds.filter((id) => id !== 1),
    });
    assert.deepEqual(restored.selectedIds, [2]);
    assert.equal(restored.leftAfterSelectedCents, withPower.leftAfterSelectedCents! + 4000 - 1500);
    assert.equal(restored.leftAfterSelectedCents, 10000 - 1500);
  });

  it("does not subtract the same pending bill twice", () => {
    const pending = bill({
      id: 1,
      name: "Sent",
      status: "pending",
      amountPaid: 25,
      dueDate: "2026-10-02",
    });
    const plan = buildPaymentPlan({
      todayIso: TODAY,
      availableBalance: 80,
      paydayEvents: paydays,
      bills: [pending],
      selectedIds: [1, 1],
    });
    assert.deepEqual(plan.selectedIds, []);
    assert.equal(plan.pendingCents, 2500);
    assert.equal(plan.selectable.some((line) => line.id === 1), false);
    assert.equal(plan.leftAfterSelectedCents, 8000 - 2500);
  });

  it("drops a bill from the action list once it is marked paid and does not subtract it again", () => {
    const paid = bill({ id: 4, name: "Cleared", status: "paid", amountPaid: 40, dueDate: "2026-10-01" });
    assert.equal(isNowActionBill(paid, TODAY), false);
    const plan = buildPaymentPlan({
      todayIso: TODAY,
      availableBalance: 80,
      paydayEvents: paydays,
      bills: [paid],
    });
    assert.equal(plan.pendingCents, 0);
    assert.equal(plan.selectedCents, 0);
    assert.equal(plan.leftAfterSelectedCents, 8000);
  });

  it("does not count scheduled income as cash on hand", () => {
    const withoutIncome = buildPaymentPlan({
      todayIso: TODAY,
      availableBalance: 100,
      paydayEvents: [],
      bills: [],
    });
    const withIncome = buildPaymentPlan({
      todayIso: TODAY,
      availableBalance: 100,
      paydayEvents: [
        { name: "Paycheck", expectedDate: "2026-11-06", status: "expected" },
        { name: "Already", expectedDate: "2026-10-01", status: "received" },
      ],
      bills: [],
    });
    assert.equal(withIncome.leftAfterSelectedCents, withoutIncome.leftAfterSelectedCents);
    assert.equal(withIncome.leftAfterSelectedCents, 10000);
    assert.equal(nextPaydayCard([
      { name: "Paycheck", expectedDate: "2026-11-06", status: "expected", expectedAmount: 1800 },
      { name: "Already", expectedDate: "2026-10-01", status: "received", expectedAmount: 1800 },
    ], TODAY)?.scheduledCents, 180000);
  });

  it("does not change the bill record while a selection is explored", () => {
    const source = bill({ id: 2, name: "Rent", dueDate: "2026-10-30", plannedAmount: 40 });
    buildPaymentPlan({
      todayIso: TODAY,
      availableBalance: 100,
      paydayEvents: paydays,
      bills: [source],
      selectedIds: [],
    });
    buildPaymentPlan({
      todayIso: TODAY,
      availableBalance: 100,
      paydayEvents: paydays,
      bills: [source],
      selectedIds: [2],
    });
    assert.equal(source.status, "scheduled");
    assert.equal(source.dueDate, "2026-10-30");
    assert.equal(source.plannedAmount, 40);
    assert.equal(source.floatTargetDate, null);
  });
});

describe("paycheck plan", () => {
  it("keeps a floated bill on its original due date and out of the period lists", () => {
    const floated = bill({
      id: 3,
      name: "Internet",
      dueDate: "2026-10-15",
      plannedAmount: 70,
      floatTargetDate: "2026-11-06",
      displayWindowKey: "pre-1",
    });
    const due = bill({
      id: 1,
      name: "Power",
      dueDate: "2026-10-21",
      plannedAmount: 12,
      displayWindowKey: "pre-1",
    });
    const grouped = groupPlanBills(
      [floated, due],
      [{ incomeEventId: 1, preKey: "pre-1", incomeKey: "income-1", label: "Paycheck" }],
      TODAY
    );
    assert.equal(grouped.floated[0]?.dueDate, "2026-10-15");
    assert.equal(grouped.floated[0]?.status, "scheduled");
    assert.deepEqual(grouped.periods[0]?.before.map((row) => row.id), [1]);
    assert.equal(grouped.periods[0]?.commitmentCents, 1200);
    assert.equal(sumObligationCents(grouped.floated), 7000);
  });

  it("replaces scheduled income once it is received and does not add the two together", () => {
    const received = paycheckGroupMoney(
      [
        {
          id: 1,
          name: "Pay",
          expectedDate: "2026-11-06",
          expectedAmount: 1000,
          actualAmount: 900,
          status: "received",
        },
      ],
      1
    );
    assert.equal(received.receivedCents, 90000);
    assert.equal(received.stillScheduledCents, 0);
    assert.deepEqual(projectGroupRemainder(received, 20000), {
      remainderCents: 70000,
      basis: "received",
    });

    const scheduled = paycheckGroupMoney(
      [
        {
          id: 1,
          name: "Pay",
          expectedDate: "2026-11-06",
          expectedAmount: 1000,
          actualAmount: null,
          status: "expected",
        },
      ],
      1
    );
    assert.equal(scheduled.receivedCents, null);
    assert.equal(scheduled.stillScheduledCents, 100000);
    assert.equal(projectGroupRemainder(scheduled, 25000).basis, "scheduled");
    assert.equal(projectGroupRemainder(scheduled, 25000).remainderCents, 75000);
  });

  it("sums a paycheck group without listing the same bill twice", () => {
    const money = paycheckGroupMoney(
      [
        {
          id: 1,
          name: "Friday",
          expectedDate: "2026-11-06",
          expectedAmount: 800,
          actualAmount: null,
          status: "expected",
        },
        {
          id: 2,
          name: "Saturday",
          expectedDate: "2026-11-07",
          expectedAmount: 200,
          actualAmount: null,
          status: "expected",
        },
      ],
      1
    );
    assert.deepEqual(money.memberIds, [1, 2]);
    assert.equal(money.stillScheduledCents, 100000);

    const shared = bill({
      id: 9,
      name: "Once",
      dueDate: "2026-11-01",
      plannedAmount: 5,
      displayWindowKey: "pre-1",
    });
    const grouped = groupPlanBills(
      [shared, shared],
      [
        { incomeEventId: 1, preKey: "pre-1", incomeKey: "income-1", label: "Friday" },
        { incomeEventId: 2, preKey: "pre-2", incomeKey: "income-2", label: "Other" },
      ],
      TODAY
    );
    assert.equal(grouped.periods[0]?.before.length, 1);
    assert.equal(grouped.periods[1]?.before.length, 0);
    assert.equal(grouped.unassigned.length, 0);
  });
});
