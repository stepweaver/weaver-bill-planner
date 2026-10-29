-- Float is a planning hold on a scheduled bill. It does not replace the payment status.
-- The original due_date stays as it is. Null target means the bill is not floated.
-- Rollback:
--   ALTER TABLE "bill_instances" DROP COLUMN IF EXISTS "floated_at";
--   ALTER TABLE "bill_instances" DROP COLUMN IF EXISTS "float_target_date";

ALTER TABLE "bill_instances" ADD COLUMN IF NOT EXISTS "float_target_date" date;
ALTER TABLE "bill_instances" ADD COLUMN IF NOT EXISTS "floated_at" timestamp;
