-- Separate payday-planning acknowledgement from income receipt.
CREATE TABLE IF NOT EXISTS "payday_acknowledgments" (
  "id" serial PRIMARY KEY,
  "ledger_id" integer NOT NULL REFERENCES "ledgers"("id"),
  "payday_date" date NOT NULL,
  "acknowledged_at" timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "payday_acknowledgments_ledger_date" ON "payday_acknowledgments" ("ledger_id", "payday_date");
ALTER TABLE "payday_acknowledgments" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payday_acknowledgments_default_ledger_only" ON "payday_acknowledgments";
CREATE POLICY "payday_acknowledgments_default_ledger_only" ON "payday_acknowledgments"
 FOR ALL USING ("ledger_id" = (SELECT "id" FROM "ledgers" WHERE "is_default" = true LIMIT 1))
 WITH CHECK ("ledger_id" = (SELECT "id" FROM "ledgers" WHERE "is_default" = true LIMIT 1));
