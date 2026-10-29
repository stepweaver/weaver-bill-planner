-- Web Push subscriptions and a durable delivery log.
-- The daily job is the only sender. There is no public cron URL.
-- Rollback:
--   DROP TABLE IF EXISTS "notification_deliveries";
--   DROP TABLE IF EXISTS "push_subscriptions";

CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" serial PRIMARY KEY,
  "ledger_id" integer NOT NULL REFERENCES "ledgers"("id"),
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "expiration_time" timestamp,
  "user_agent" text,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint" ON "push_subscriptions" ("endpoint");

CREATE TABLE IF NOT EXISTS "notification_deliveries" (
  "id" serial PRIMARY KEY,
  "ledger_id" integer NOT NULL REFERENCES "ledgers"("id"),
  "subscription_id" integer REFERENCES "push_subscriptions"("id") ON DELETE SET NULL,
  "dedupe_key" text NOT NULL,
  "kind" text NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "target_path" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "attempt_count" integer NOT NULL DEFAULT 0,
  "last_error" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  "sent_at" timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS "notification_deliveries_dedupe_subscription"
  ON "notification_deliveries" ("dedupe_key", "subscription_id");

ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push_subscriptions_default_ledger_only" ON "push_subscriptions";
CREATE POLICY "push_subscriptions_default_ledger_only" ON "push_subscriptions"
  FOR ALL
  USING ("ledger_id" = (SELECT "id" FROM "ledgers" WHERE "is_default" = true LIMIT 1))
  WITH CHECK ("ledger_id" = (SELECT "id" FROM "ledgers" WHERE "is_default" = true LIMIT 1));

ALTER TABLE "notification_deliveries" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notification_deliveries_default_ledger_only" ON "notification_deliveries";
CREATE POLICY "notification_deliveries_default_ledger_only" ON "notification_deliveries"
  FOR ALL
  USING ("ledger_id" = (SELECT "id" FROM "ledgers" WHERE "is_default" = true LIMIT 1))
  WITH CHECK ("ledger_id" = (SELECT "id" FROM "ledgers" WHERE "is_default" = true LIMIT 1));
