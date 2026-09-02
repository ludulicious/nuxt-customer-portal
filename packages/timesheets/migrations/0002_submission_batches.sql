CREATE TABLE "timesheets"."submission" (
	"id" text PRIMARY KEY NOT NULL,
	"weekly_timesheet_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"period_starts_on" date NOT NULL,
	"period_ends_on" date NOT NULL,
	"status" "timesheets"."timesheet_status" DEFAULT 'DRAFT' NOT NULL,
	"submitted_at" timestamp,
	"reviewed_at" timestamp,
	"reviewed_by_id" text,
	"rejection_comment" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "timesheets"."submission" ADD CONSTRAINT "submission_weekly_timesheet_id_weekly_timesheet_id_fk" FOREIGN KEY ("weekly_timesheet_id") REFERENCES "timesheets"."weekly_timesheet"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "timesheets"."submission" ADD CONSTRAINT "submission_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "timesheets"."submission" ADD CONSTRAINT "submission_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "timesheets"."submission" ADD CONSTRAINT "submission_reviewed_by_id_user_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."user"("id") ON DELETE set null;--> statement-breakpoint
ALTER TABLE "timesheets"."time_entry" ADD COLUMN "submission_id" text;--> statement-breakpoint
ALTER TABLE "timesheets"."client_review" ADD COLUMN "submission_id" text;--> statement-breakpoint
ALTER TABLE "timesheets"."client_review_history" ADD COLUMN "submission_id" text;--> statement-breakpoint
ALTER TABLE "timesheets"."approval_history" ADD COLUMN "submission_id" text;--> statement-breakpoint
INSERT INTO "timesheets"."submission" ("id", "weekly_timesheet_id", "organization_id", "user_id", "period_starts_on", "period_ends_on", "status", "submitted_at", "reviewed_at", "reviewed_by_id", "rejection_comment", "created_at", "updated_at")
SELECT 'legacy_' || w."id", w."id", w."organization_id", w."user_id", w."week_starts_on", w."week_starts_on" + 6, w."status", w."submitted_at", w."reviewed_at", w."reviewed_by_id", w."rejection_comment", w."created_at", w."updated_at"
FROM "timesheets"."weekly_timesheet" w
WHERE w."status" <> 'DRAFT';--> statement-breakpoint
UPDATE "timesheets"."time_entry" e SET "submission_id" = 'legacy_' || e."weekly_timesheet_id"
FROM "timesheets"."weekly_timesheet" w WHERE w."id" = e."weekly_timesheet_id" AND w."status" <> 'DRAFT';--> statement-breakpoint
UPDATE "timesheets"."client_review" r SET "submission_id" = 'legacy_' || r."weekly_timesheet_id"
FROM "timesheets"."weekly_timesheet" w WHERE w."id" = r."weekly_timesheet_id" AND w."status" <> 'DRAFT';--> statement-breakpoint
UPDATE "timesheets"."client_review_history" h SET "submission_id" = 'legacy_' || h."weekly_timesheet_id"
FROM "timesheets"."weekly_timesheet" w WHERE w."id" = h."weekly_timesheet_id" AND w."status" <> 'DRAFT';--> statement-breakpoint
UPDATE "timesheets"."approval_history" h SET "submission_id" = 'legacy_' || h."weekly_timesheet_id"
FROM "timesheets"."weekly_timesheet" w WHERE w."id" = h."weekly_timesheet_id" AND w."status" <> 'DRAFT';--> statement-breakpoint
ALTER TABLE "timesheets"."time_entry" ADD CONSTRAINT "time_entry_submission_id_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "timesheets"."submission"("id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "timesheets"."client_review" ADD CONSTRAINT "client_review_submission_id_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "timesheets"."submission"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "timesheets"."client_review_history" ADD CONSTRAINT "client_review_history_submission_id_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "timesheets"."submission"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "timesheets"."approval_history" ADD CONSTRAINT "approval_history_submission_id_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "timesheets"."submission"("id") ON DELETE cascade;--> statement-breakpoint
DROP INDEX IF EXISTS "timesheets"."client_review_week_client_uidx";--> statement-breakpoint
CREATE UNIQUE INDEX "client_review_submission_client_uidx" ON "timesheets"."client_review" USING btree ("submission_id", "client_organization_id");--> statement-breakpoint
CREATE INDEX "submission_week_idx" ON "timesheets"."submission" USING btree ("weekly_timesheet_id");--> statement-breakpoint
CREATE INDEX "submission_org_status_idx" ON "timesheets"."submission" USING btree ("organization_id", "status");--> statement-breakpoint
CREATE INDEX "submission_user_period_idx" ON "timesheets"."submission" USING btree ("user_id", "period_starts_on", "period_ends_on");--> statement-breakpoint
CREATE INDEX "time_entry_submission_idx" ON "timesheets"."time_entry" USING btree ("submission_id");
