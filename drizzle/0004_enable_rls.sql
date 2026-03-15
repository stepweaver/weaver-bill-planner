-- Enable Row-Level Security on user-facing tables (backstop; app already scopes by session and default ledger).
-- Policies restrict access to rows belonging to the default ledger.

ALTER TABLE "ledgers" ENABLE ROW LEVEL SECURITY;
-- Allow access to ledgers (app needs to read default ledger id).
CREATE POLICY "ledgers_default_scope" ON "ledgers" FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE "months" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "months_default_ledger_only" ON "months"
  FOR ALL
  USING ("ledger_id" = (SELECT "id" FROM "ledgers" WHERE "is_default" = true LIMIT 1))
  WITH CHECK ("ledger_id" = (SELECT "id" FROM "ledgers" WHERE "is_default" = true LIMIT 1));

ALTER TABLE "bill_templates" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bill_templates_default_ledger_only" ON "bill_templates"
  FOR ALL
  USING ("ledger_id" = (SELECT "id" FROM "ledgers" WHERE "is_default" = true LIMIT 1))
  WITH CHECK ("ledger_id" = (SELECT "id" FROM "ledgers" WHERE "is_default" = true LIMIT 1));

ALTER TABLE "income_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "income_events_default_ledger_only" ON "income_events"
  FOR ALL
  USING (
    "month_id" IN (
      SELECT "id" FROM "months"
      WHERE "ledger_id" = (SELECT "id" FROM "ledgers" WHERE "is_default" = true LIMIT 1)
    )
  )
  WITH CHECK (
    "month_id" IN (
      SELECT "id" FROM "months"
      WHERE "ledger_id" = (SELECT "id" FROM "ledgers" WHERE "is_default" = true LIMIT 1)
    )
  );

ALTER TABLE "bill_instances" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bill_instances_default_ledger_only" ON "bill_instances"
  FOR ALL
  USING (
    "month_id" IN (
      SELECT "id" FROM "months"
      WHERE "ledger_id" = (SELECT "id" FROM "ledgers" WHERE "is_default" = true LIMIT 1)
    )
  )
  WITH CHECK (
    "month_id" IN (
      SELECT "id" FROM "months"
      WHERE "ledger_id" = (SELECT "id" FROM "ledgers" WHERE "is_default" = true LIMIT 1)
    )
  );
