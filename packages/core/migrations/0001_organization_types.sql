ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "organization_type" text;
UPDATE "organization" SET "organization_type" = 'CLIENT' WHERE "organization_type" IS NULL;
ALTER TABLE "organization" ALTER COLUMN "organization_type" SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE "organization" ADD CONSTRAINT "organization_type_check" CHECK ("organization_type" IN ('OWNER', 'CLIENT'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "organization_single_owner_uidx" ON "organization" ("organization_type") WHERE "organization_type" = 'OWNER';
ALTER TABLE "member" ADD COLUMN IF NOT EXISTS "phone" text;
ALTER TABLE "member" ADD COLUMN IF NOT EXISTS "job_title" text;
