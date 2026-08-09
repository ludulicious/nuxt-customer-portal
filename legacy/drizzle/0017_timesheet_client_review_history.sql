CREATE TYPE "timesheets"."client_review_action" AS ENUM('APPROVED', 'DISPUTED');
CREATE TABLE "timesheets"."client_review_history" (
  "id" text PRIMARY KEY,
  "weekly_timesheet_id" text NOT NULL REFERENCES "timesheets"."weekly_timesheet"("id") ON DELETE cascade,
  "client_organization_id" text NOT NULL REFERENCES "public"."organization"("id") ON DELETE restrict,
  "action" "timesheets"."client_review_action" NOT NULL,
  "actor_user_id" text NOT NULL REFERENCES "public"."user"("id") ON DELETE restrict,
  "comment" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "client_review_history_week_client_idx" ON "timesheets"."client_review_history" ("weekly_timesheet_id", "client_organization_id", "created_at");
INSERT INTO "timesheets"."client_review_history" ("id", "weekly_timesheet_id", "client_organization_id", "action", "actor_user_id", "comment", "created_at")
SELECT 'backfill-' || "id", "weekly_timesheet_id", "client_organization_id", "status"::text::"timesheets"."client_review_action", "reviewer_user_id", "comment", COALESCE("reviewed_at", "updated_at")
FROM "timesheets"."client_review"
WHERE "status" IN ('APPROVED', 'DISPUTED') AND "reviewer_user_id" IS NOT NULL;
