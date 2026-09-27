-- Current available bank balance for the ledger (what the bank says can be spent now).
-- Exact cents. Not a month balance. Null until the user enters a snapshot.
ALTER TABLE "ledgers" ADD COLUMN "available_balance" numeric(12, 2);
ALTER TABLE "ledgers" ADD COLUMN "available_balance_updated_at" timestamp;
