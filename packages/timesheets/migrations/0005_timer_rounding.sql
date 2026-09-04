ALTER TABLE "timesheets"."workspace_settings" ADD COLUMN IF NOT EXISTS "timer_rounding_minutes" integer DEFAULT 1 NOT NULL CHECK ("timer_rounding_minutes" BETWEEN 1 AND 60);
