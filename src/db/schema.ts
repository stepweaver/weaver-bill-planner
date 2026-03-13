import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean,
  real,
  date,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const ledgers = pgTable("ledgers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const months = pgTable(
  "months",
  {
    id: serial("id").primaryKey(),
    ledgerId: integer("ledger_id")
      .notNull()
      .references(() => ledgers.id),
    monthKey: text("month_key").notNull(),
    label: text("label").notNull(),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [uniqueIndex("months_ledger_month_key").on(t.ledgerId, t.monthKey)]
);

export const billTemplates = pgTable("bill_templates", {
  id: serial("id").primaryKey(),
  ledgerId: integer("ledger_id")
    .notNull()
    .references(() => ledgers.id),
  name: text("name").notNull(),
  defaultDueDay: integer("default_due_day"),
  defaultPlannedAmount: real("default_planned_amount"),
  defaultPaymentUrl: text("default_payment_url"),
  active: boolean("active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const incomeEvents = pgTable("income_events", {
  id: serial("id").primaryKey(),
  monthId: integer("month_id")
    .notNull()
    .references(() => months.id),
  name: text("name").notNull(),
  expectedDate: date("expected_date").notNull(),
  expectedAmount: real("expected_amount"),
  actualAmount: real("actual_amount"),
  status: text("status").notNull().default("expected"),
  notes: text("notes"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const billInstances = pgTable("bill_instances", {
  id: serial("id").primaryKey(),
  monthId: integer("month_id")
    .notNull()
    .references(() => months.id),
  templateId: integer("template_id").references(() => billTemplates.id),
  name: text("name").notNull(),
  dueDate: date("due_date"),
  plannedAmount: real("planned_amount"),
  invoiceAmount: real("invoice_amount"),
  amountPaid: real("amount_paid"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  paymentUrl: text("payment_url"),
  assignedIncomeEventId: integer("assigned_income_event_id").references(
    () => incomeEvents.id
  ),
  assignedGroupKey: text("assigned_group_key"),
  manualAssignment: boolean("manual_assignment").default(false),
  isRecurring: boolean("is_recurring").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const ledgersRelations = relations(ledgers, ({ many }) => ({
  months: many(months),
  billTemplates: many(billTemplates),
}));

export const monthsRelations = relations(months, ({ one, many }) => ({
  ledger: one(ledgers),
  billInstances: many(billInstances),
  incomeEvents: many(incomeEvents),
}));

export const billTemplatesRelations = relations(billTemplates, ({ one }) => ({
  ledger: one(ledgers),
}));

export const incomeEventsRelations = relations(incomeEvents, ({ one, many }) => ({
  month: one(months),
  assignedBills: many(billInstances),
}));

export const billInstancesRelations = relations(billInstances, ({ one }) => ({
  month: one(months),
  template: one(billTemplates),
  assignedIncomeEvent: one(incomeEvents),
}));
