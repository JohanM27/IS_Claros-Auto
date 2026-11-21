-- Add order registration support without dropping or rewriting existing order data.
ALTER TABLE "WorkOrder"
  ADD COLUMN "kilometraje" INTEGER,
  ADD COLUMN "idempotencyKey" UUID,
  ADD COLUMN "requestHash" CHAR(64);

UPDATE "WorkOrder"
SET "idempotencyKey" = gen_random_uuid(), "requestHash" = repeat('0', 64)
WHERE "idempotencyKey" IS NULL OR "requestHash" IS NULL;

ALTER TABLE "WorkOrder"
  ALTER COLUMN "idempotencyKey" SET NOT NULL,
  ALTER COLUMN "requestHash" SET NOT NULL;

CREATE UNIQUE INDEX "WorkOrder_idempotencyKey_key" ON "WorkOrder"("idempotencyKey");

CREATE SEQUENCE "work_order_number_seq";
DO $$
DECLARE last_number BIGINT;
BEGIN
  SELECT COALESCE(MAX(substring("numeroOrden" from '^OT-([0-9]+)$')::BIGINT), 0)
  INTO last_number FROM "WorkOrder";
  PERFORM setval('"work_order_number_seq"', GREATEST(last_number, 1), last_number > 0);
END $$;
