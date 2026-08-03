CREATE SCHEMA "timesheets";
--> statement-breakpoint
CREATE TYPE "timesheets"."approval_action" AS ENUM('SUBMITTED', 'APPROVED', 'REJECTED', 'REOPENED');--> statement-breakpoint
CREATE TYPE "timesheets"."project_status" AS ENUM('ACTIVE', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "timesheets"."timesheet_status" AS ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "timesheets"."activity_type" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"billable" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheets"."project" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"client_organization_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"status" "timesheets"."project_status" DEFAULT 'ACTIVE' NOT NULL,
	"starts_on" date,
	"ends_on" date,
	"budget_minutes" integer,
	"budget_minor" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheets"."project_activity" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"activity_type_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheets"."project_person_tariff" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"hourly_rate_minor" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheets"."team_tariff" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"hourly_rate_minor" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheets"."time_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"weekly_timesheet_id" text NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text NOT NULL,
	"activity_type_id" text NOT NULL,
	"entry_date" date NOT NULL,
	"duration_minutes" integer DEFAULT 0 NOT NULL,
	"note" text,
	"billable_snapshot" boolean NOT NULL,
	"hourly_rate_minor_snapshot" integer NOT NULL,
	"currency_snapshot" text NOT NULL,
	"timer_started_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheets"."approval_history" (
	"id" text PRIMARY KEY NOT NULL,
	"weekly_timesheet_id" text NOT NULL,
	"action" "timesheets"."approval_action" NOT NULL,
	"actor_user_id" text NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheets"."weekly_timesheet" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"week_starts_on" date NOT NULL,
	"status" "timesheets"."timesheet_status" DEFAULT 'DRAFT' NOT NULL,
	"submitted_at" timestamp,
	"reviewed_at" timestamp,
	"reviewed_by_id" text,
	"rejection_comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheets"."workspace_client" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_organization_id" text NOT NULL,
	"client_organization_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheets"."workspace_settings" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"timezone" text DEFAULT 'Europe/Amsterdam' NOT NULL,
	"week_starts_on" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "timesheets"."activity_type" ADD CONSTRAINT "activity_type_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."project" ADD CONSTRAINT "project_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."project" ADD CONSTRAINT "project_client_organization_id_organization_id_fk" FOREIGN KEY ("client_organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."project_activity" ADD CONSTRAINT "project_activity_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "timesheets"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."project_activity" ADD CONSTRAINT "project_activity_activity_type_id_activity_type_id_fk" FOREIGN KEY ("activity_type_id") REFERENCES "timesheets"."activity_type"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."project_person_tariff" ADD CONSTRAINT "project_person_tariff_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "timesheets"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."project_person_tariff" ADD CONSTRAINT "project_person_tariff_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."team_tariff" ADD CONSTRAINT "team_tariff_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."team_tariff" ADD CONSTRAINT "team_tariff_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."time_entry" ADD CONSTRAINT "time_entry_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."time_entry" ADD CONSTRAINT "time_entry_weekly_timesheet_id_weekly_timesheet_id_fk" FOREIGN KEY ("weekly_timesheet_id") REFERENCES "timesheets"."weekly_timesheet"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."time_entry" ADD CONSTRAINT "time_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."time_entry" ADD CONSTRAINT "time_entry_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "timesheets"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."time_entry" ADD CONSTRAINT "time_entry_activity_type_id_activity_type_id_fk" FOREIGN KEY ("activity_type_id") REFERENCES "timesheets"."activity_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."approval_history" ADD CONSTRAINT "approval_history_weekly_timesheet_id_weekly_timesheet_id_fk" FOREIGN KEY ("weekly_timesheet_id") REFERENCES "timesheets"."weekly_timesheet"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."approval_history" ADD CONSTRAINT "approval_history_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."weekly_timesheet" ADD CONSTRAINT "weekly_timesheet_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."weekly_timesheet" ADD CONSTRAINT "weekly_timesheet_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."weekly_timesheet" ADD CONSTRAINT "weekly_timesheet_reviewed_by_id_user_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."workspace_client" ADD CONSTRAINT "workspace_client_workspace_organization_id_organization_id_fk" FOREIGN KEY ("workspace_organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."workspace_client" ADD CONSTRAINT "workspace_client_client_organization_id_organization_id_fk" FOREIGN KEY ("client_organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."workspace_settings" ADD CONSTRAINT "workspace_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activity_type_org_name_uidx" ON "timesheets"."activity_type" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "activity_type_org_idx" ON "timesheets"."activity_type" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_org_name_uidx" ON "timesheets"."project" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "project_org_status_idx" ON "timesheets"."project" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "project_client_idx" ON "timesheets"."project" USING btree ("client_organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_activity_project_activity_uidx" ON "timesheets"."project_activity" USING btree ("project_id","activity_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_person_tariff_project_user_uidx" ON "timesheets"."project_person_tariff" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_tariff_org_user_uidx" ON "timesheets"."team_tariff" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "time_entry_org_user_date_idx" ON "timesheets"."time_entry" USING btree ("organization_id","user_id","entry_date");--> statement-breakpoint
CREATE INDEX "time_entry_week_idx" ON "timesheets"."time_entry" USING btree ("weekly_timesheet_id");--> statement-breakpoint
CREATE INDEX "time_entry_project_idx" ON "timesheets"."time_entry" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "time_entry_one_running_timer_uidx" ON "timesheets"."time_entry" USING btree ("organization_id","user_id") WHERE "timer_started_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "approval_history_week_idx" ON "timesheets"."approval_history" USING btree ("weekly_timesheet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_timesheet_org_user_week_uidx" ON "timesheets"."weekly_timesheet" USING btree ("organization_id","user_id","week_starts_on");--> statement-breakpoint
CREATE INDEX "weekly_timesheet_org_status_idx" ON "timesheets"."weekly_timesheet" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_client_workspace_client_uidx" ON "timesheets"."workspace_client" USING btree ("workspace_organization_id","client_organization_id");--> statement-breakpoint
CREATE INDEX "workspace_client_workspace_idx" ON "timesheets"."workspace_client" USING btree ("workspace_organization_id");
