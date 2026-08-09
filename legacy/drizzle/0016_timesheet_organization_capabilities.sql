ALTER TABLE "timesheets"."workspace_settings" ADD COLUMN "workspace_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "timesheets"."workspace_settings" ADD COLUMN "invoicing_enabled" boolean DEFAULT false NOT NULL;
UPDATE "timesheets"."workspace_settings" SET "workspace_enabled" = true, "invoicing_enabled" = true;
