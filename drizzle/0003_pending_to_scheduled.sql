-- Treat existing "pending" bills as "scheduled" (not yet sent).
-- After this, only bills you explicitly mark "Pending" (sent, not yet cleared) will show the pending badge.
UPDATE "bill_instances" SET "status" = 'scheduled' WHERE "status" = 'pending';

-- Ensure new rows default to 'scheduled' (matches schema default).
ALTER TABLE "bill_instances" ALTER COLUMN "status" SET DEFAULT 'scheduled';
