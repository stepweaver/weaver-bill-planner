import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { safeCallbackPath, unauthenticatedRedirect } from "./callback-path";
import { ledgerTodayIso } from "./ledger-time";
import {
  dailyDedupeKey,
  deliveryClaim,
  evaluateReminders,
  isExpiredPushSubscription,
  type ReminderBill,
  type ReminderIncome,
} from "./reminders";

const TODAY = "2026-10-28";

function bill(overrides: Partial<ReminderBill> & Pick<ReminderBill, "id">): ReminderBill {
  return {
    name: "Bill",
    dueDate: TODAY,
    status: "scheduled",
    floatTargetDate: null,
    ownerMonthKey: "2026-10",
    ...overrides,
  };
}

function income(overrides: Partial<ReminderIncome> = {}): ReminderIncome {
  return {
    id: 1,
    name: "Paycheck",
    expectedDate: TODAY,
    status: "expected",
    ...overrides,
  };
}

function plan(bills: ReminderBill[], incomeEvents: ReminderIncome[] = [], month: string | null = "2026-10") {
  return evaluateReminders({
    todayIso: TODAY,
    workspaceMonthKey: month,
    bills,
    income: incomeEvents,
  });
}

describe("due and payday reminders", () => {
  it("notifies a scheduled bill due today", () => {
    const result = plan([bill({ id: 4, name: "Rent" })]);
    assert.equal(result.shouldNotify, true);
    assert.equal(result.kind, "due");
    assert.deepEqual(result.dueBillIds, [4]);
    assert.equal(result.body, "Bills are due today. Open λledger to plan payments.");
    assert.equal(result.body.includes("$"), false);
    assert.equal(result.targetPath, "/months/2026-10");
    assert.equal(result.dedupeKey, dailyDedupeKey(TODAY));
  });

  it("asks the user to verify a scheduled paycheck and does not say it arrived", () => {
    const result = plan([], [income()]);
    assert.equal(result.kind, "payday");
    assert.match(result.body, /scheduled today/);
    assert.match(result.body, /Verify the deposit/);
    assert.equal(/arrived|deposited|\$/i.test(result.body), false);
    assert.deepEqual(result.paydayNames, ["Paycheck"]);
  });

  it("combines payday and due bills into one notification", () => {
    const result = plan([bill({ id: 2 })], [income()]);
    assert.equal(result.kind, "combined");
    assert.match(result.body, /paycheck is scheduled/);
    assert.match(result.body, /bills are ready/);
    assert.equal(result.dedupeKey, plan([bill({ id: 9 })]).dedupeKey);
  });

  it("suppresses pending, paid, skipped, and actively floated bills", () => {
    const result = plan([
      bill({ id: 1, status: "pending" }),
      bill({ id: 2, status: "paid" }),
      bill({ id: 3, status: "skipped" }),
      bill({ id: 4, status: "scheduled", floatTargetDate: "2026-11-06" }),
    ]);
    assert.equal(result.shouldNotify, false);
    assert.deepEqual(result.dueBillIds, []);
  });

  it("notifies when a float expires today even if the original due date was earlier", () => {
    const result = plan([
      bill({
        id: 8,
        dueDate: "2026-10-01",
        floatTargetDate: TODAY,
        ownerMonthKey: "2026-09",
      }),
    ]);
    assert.equal(result.kind, "resurface");
    assert.deepEqual(result.resurfacedBillIds, [8]);
    assert.deepEqual(result.dueBillIds, []);
    assert.equal(result.body.includes("$"), false);
  });

  it("includes a prior-month bill whose original due date is today", () => {
    const result = plan([
      bill({ id: 15, dueDate: TODAY, ownerMonthKey: "2026-09", name: "Carry" }),
    ]);
    assert.deepEqual(result.dueBillIds, [15]);
    assert.equal(result.targetPath, "/months/2026-10");
  });

  it("ignores a paycheck already marked received", () => {
    const result = plan([], [income({ status: "received" })]);
    assert.equal(result.shouldNotify, false);
  });

  it("falls back to the months list when the workspace month is missing", () => {
    const result = plan([bill({ id: 1 })], [], null);
    assert.equal(result.targetPath, "/months");
  });
});

describe("delivery and navigation", () => {
  it("skips a second claim while a send is in flight or already sent", () => {
    assert.equal(deliveryClaim(null), "insert");
    assert.equal(deliveryClaim({ status: "pending", attemptCount: 0 }), "claim");
    assert.equal(deliveryClaim({ status: "sending", attemptCount: 1 }), "skip");
    assert.equal(deliveryClaim({ status: "sent", attemptCount: 1 }), "skip");
    assert.equal(deliveryClaim({ status: "failed", attemptCount: 1 }), "claim");
    assert.equal(deliveryClaim({ status: "failed", attemptCount: 3 }), "skip");
    assert.equal(dailyDedupeKey(TODAY), dailyDedupeKey(TODAY));
  });

  it("treats revoked push endpoints as expired", () => {
    assert.equal(isExpiredPushSubscription(404), true);
    assert.equal(isExpiredPushSubscription(410), true);
    assert.equal(isExpiredPushSubscription(500), false);
    assert.equal(isExpiredPushSubscription(undefined), false);
  });

  it("sends notification clicks through login without an open redirect", () => {
    assert.equal(
      unauthenticatedRedirect("/months/2026-10"),
      "/login?callbackUrl=%2Fmonths%2F2026-10"
    );
    assert.equal(safeCallbackPath("/months/2026-10"), "/months/2026-10");
    assert.equal(safeCallbackPath("https://evil.example"), "/months");
    assert.equal(safeCallbackPath("//evil.example"), "/months");
    assert.equal(safeCallbackPath("/login"), "/months");
  });

  it("opens the ledger path from the service worker and keeps the icon", () => {
    const source = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
    assert.match(source, /notification\.data/);
    assert.match(source, /\/icons\/icon-192\.png/);
    assert.match(source, /openWindow/);
    assert.equal(source.includes("$"), false);
  });

  it("schedules the VPS job at 9:00 AM Indianapolis time", () => {
    const timer = readFileSync(new URL("../../deploy/ledger-notify.timer", import.meta.url), "utf8");
    const service = readFileSync(new URL("../../deploy/ledger-notify.service", import.meta.url), "utf8");
    assert.match(timer, /OnCalendar=\*-\*-\* 09:00:00/);
    assert.match(timer, /Timezone=America\/Indiana\/Indianapolis/);
    assert.match(service, /npm run notify/);
    assert.equal(service.includes("curl"), false);
  });
});

describe("ledger timezone", () => {
  it("keeps the Indianapolis calendar date across the DST boundaries", () => {
    assert.equal(ledgerTodayIso(new Date("2026-03-08T04:30:00Z")), "2026-03-07");
    assert.equal(ledgerTodayIso(new Date("2026-03-08T05:30:00Z")), "2026-03-08");
    assert.equal(ledgerTodayIso(new Date("2026-03-08T06:30:00Z")), "2026-03-08");
    assert.equal(ledgerTodayIso(new Date("2026-03-08T07:30:00Z")), "2026-03-08");
    assert.equal(ledgerTodayIso(new Date("2026-11-01T03:30:00Z")), "2026-10-31");
    assert.equal(ledgerTodayIso(new Date("2026-11-01T04:30:00Z")), "2026-11-01");
    assert.equal(ledgerTodayIso(new Date("2026-11-01T06:30:00Z")), "2026-11-01");
  });
});
