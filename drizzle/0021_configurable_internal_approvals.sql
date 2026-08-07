ALTER TABLE "timesheets"."workspace_settings" ADD COLUMN "internal_approvals_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "timesheets"."team_member_settings" ADD COLUMN "internal_approval_required" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE TABLE "timesheets"."internal_approver_assignment" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"submitter_user_id" text NOT NULL,
	"approver_user_id" text NOT NULL,
	"created_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "internal_approver_assignment_not_self" CHECK ("submitter_user_id" <> "approver_user_id")
);--> statement-breakpoint
ALTER TABLE "timesheets"."internal_approver_assignment" ADD CONSTRAINT "internal_approver_assignment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "timesheets"."internal_approver_assignment" ADD CONSTRAINT "internal_approver_assignment_submitter_user_id_user_id_fk" FOREIGN KEY ("submitter_user_id") REFERENCES "public"."user"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "timesheets"."internal_approver_assignment" ADD CONSTRAINT "internal_approver_assignment_approver_user_id_user_id_fk" FOREIGN KEY ("approver_user_id") REFERENCES "public"."user"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "timesheets"."internal_approver_assignment" ADD CONSTRAINT "internal_approver_assignment_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE restrict;--> statement-breakpoint
CREATE UNIQUE INDEX "internal_approver_assignment_org_submitter_approver_uidx" ON "timesheets"."internal_approver_assignment" ("organization_id","submitter_user_id","approver_user_id");--> statement-breakpoint
CREATE INDEX "internal_approver_assignment_approver_idx" ON "timesheets"."internal_approver_assignment" ("organization_id","approver_user_id");--> statement-breakpoint
CREATE INDEX "internal_approver_assignment_submitter_idx" ON "timesheets"."internal_approver_assignment" ("organization_id","submitter_user_id");--> statement-breakpoint
INSERT INTO "timesheets"."internal_approver_assignment" ("id", "organization_id", "submitter_user_id", "approver_user_id", "created_by_id")
SELECT 'internal-approval-' || m."organization_id" || '-' || submitter."user_id" || '-' || m."user_id",
       m."organization_id", submitter."user_id", m."user_id", m."user_id"
FROM "public"."member" m
JOIN "public"."member" submitter ON submitter."organization_id" = m."organization_id" AND submitter."user_id" <> m."user_id"
JOIN "timesheets"."workspace_settings" ws ON ws."organization_id" = m."organization_id"
WHERE m."role" IN ('owner', 'admin')
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "timesheets"."team_member_settings" ("id", "organization_id", "user_id", "can_enter_time", "internal_approval_required")
SELECT 'internal-approval-setting-' || m."organization_id" || '-' || m."user_id", m."organization_id", m."user_id", true, false
FROM "public"."member" m
JOIN "timesheets"."workspace_settings" ws ON ws."organization_id" = m."organization_id"
WHERE NOT EXISTS (
  SELECT 1 FROM "timesheets"."internal_approver_assignment" a
  WHERE a."organization_id" = m."organization_id" AND a."submitter_user_id" = m."user_id"
)
ON CONFLICT ("organization_id", "user_id") DO UPDATE SET "internal_approval_required" = false;--> statement-breakpoint
WITH auto_approved AS (
  UPDATE "timesheets"."weekly_timesheet" wt SET "status" = 'APPROVED', "reviewed_at" = now(), "reviewed_by_id" = NULL
  WHERE wt."status" = 'SUBMITTED' AND EXISTS (
    SELECT 1 FROM "timesheets"."team_member_settings" tms
    WHERE tms."organization_id" = wt."organization_id" AND tms."user_id" = wt."user_id" AND tms."internal_approval_required" = false
  ) RETURNING wt."id", wt."user_id"
)
INSERT INTO "timesheets"."approval_history" ("id", "weekly_timesheet_id", "action", "actor_user_id", "comment")
SELECT 'internal-approval-migration-' || aa."id", aa."id", 'APPROVED', aa."user_id", 'Automatically approved during internal approval configuration migration'
FROM auto_approved aa;
--> statement-breakpoint
INSERT INTO "timesheets"."client_review" ("id", "weekly_timesheet_id", "client_organization_id", "status")
SELECT 'internal-approval-client-review-' || wt."id" || '-' || te."client_organization_id",
       wt."id", te."client_organization_id", 'PENDING'
FROM "timesheets"."weekly_timesheet" wt
JOIN "timesheets"."time_entry" te ON te."weekly_timesheet_id" = wt."id"
JOIN "timesheets"."workspace_client" wc ON wc."workspace_organization_id" = wt."organization_id"
  AND wc."client_organization_id" = te."client_organization_id" AND wc."access_mode" = 'REVIEW'
WHERE EXISTS (
  SELECT 1 FROM "timesheets"."approval_history" ah
  WHERE ah."weekly_timesheet_id" = wt."id" AND ah."id" = 'internal-approval-migration-' || wt."id"
)
GROUP BY wt."id", te."client_organization_id"
ON CONFLICT ("weekly_timesheet_id", "client_organization_id") DO NOTHING;
