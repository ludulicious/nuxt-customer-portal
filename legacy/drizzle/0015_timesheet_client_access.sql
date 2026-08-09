CREATE TYPE "timesheets"."client_access_mode" AS ENUM('DISABLED', 'VIEW', 'REVIEW');
CREATE TYPE "timesheets"."client_review_status" AS ENUM('PENDING', 'APPROVED', 'DISPUTED');
ALTER TABLE "timesheets"."workspace_client" ADD COLUMN "access_mode" "timesheets"."client_access_mode" DEFAULT 'DISABLED' NOT NULL;
ALTER TABLE "timesheets"."time_entry" ADD COLUMN "client_organization_id" text;
UPDATE "timesheets"."time_entry" AS entry SET "client_organization_id" = project."client_organization_id" FROM "timesheets"."project" AS project WHERE project."id" = entry."project_id";
ALTER TABLE "timesheets"."time_entry" ALTER COLUMN "client_organization_id" SET NOT NULL;
ALTER TABLE "timesheets"."time_entry" ADD CONSTRAINT "time_entry_client_organization_id_organization_id_fk" FOREIGN KEY ("client_organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict;
CREATE INDEX "time_entry_client_idx" ON "timesheets"."time_entry" ("client_organization_id");
CREATE TABLE "timesheets"."workspace_client_reviewer" (
  "id" text PRIMARY KEY, "workspace_client_id" text NOT NULL REFERENCES "timesheets"."workspace_client"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "public"."user"("id") ON DELETE cascade,
  "created_by_id" text NOT NULL REFERENCES "public"."user"("id") ON DELETE restrict,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "workspace_client_reviewer_link_user_uidx" ON "timesheets"."workspace_client_reviewer" ("workspace_client_id", "user_id");
CREATE INDEX "workspace_client_reviewer_user_idx" ON "timesheets"."workspace_client_reviewer" ("user_id");
CREATE TABLE "timesheets"."client_review" (
  "id" text PRIMARY KEY, "weekly_timesheet_id" text NOT NULL REFERENCES "timesheets"."weekly_timesheet"("id") ON DELETE cascade,
  "client_organization_id" text NOT NULL REFERENCES "public"."organization"("id") ON DELETE restrict,
  "status" "timesheets"."client_review_status" DEFAULT 'PENDING' NOT NULL,
  "reviewer_user_id" text REFERENCES "public"."user"("id") ON DELETE set null, "comment" text,
  "version" integer DEFAULT 1 NOT NULL, "reviewed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "client_review_week_client_uidx" ON "timesheets"."client_review" ("weekly_timesheet_id", "client_organization_id");
CREATE INDEX "client_review_client_status_idx" ON "timesheets"."client_review" ("client_organization_id", "status");
