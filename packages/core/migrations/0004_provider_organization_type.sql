DROP INDEX IF EXISTS "organization_single_owner_uidx";

ALTER TABLE "organization"
  DROP CONSTRAINT IF EXISTS "organization_type_check";

UPDATE "organization"
SET "organization_type" = 'PROVIDER'
WHERE "organization_type" = 'OWNER';

ALTER TABLE "organization"
  ADD CONSTRAINT "organization_type_check"
  CHECK ("organization_type" IN ('PROVIDER', 'CLIENT'));

CREATE UNIQUE INDEX IF NOT EXISTS "organization_single_provider_uidx"
  ON "organization" ("organization_type")
  WHERE "organization_type" = 'PROVIDER';
