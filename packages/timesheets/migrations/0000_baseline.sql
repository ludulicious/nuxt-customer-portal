CREATE SCHEMA "timesheets";
--> statement-breakpoint
CREATE TYPE "timesheets"."approval_action" AS ENUM('SUBMITTED', 'APPROVED', 'REJECTED', 'REOPENED');--> statement-breakpoint
CREATE TYPE "timesheets"."client_access_mode" AS ENUM('DISABLED', 'VIEW', 'REVIEW');--> statement-breakpoint
CREATE TYPE "timesheets"."client_review_action" AS ENUM('APPROVED', 'DISPUTED');--> statement-breakpoint
CREATE TYPE "timesheets"."client_review_status" AS ENUM('PENDING', 'APPROVED', 'DISPUTED');--> statement-breakpoint
CREATE TYPE "timesheets"."invoice_email_delivery_status" AS ENUM('PENDING', 'SENT', 'FAILED');--> statement-breakpoint
CREATE TYPE "timesheets"."invoice_email_purpose" AS ENUM('INVOICE', 'REMINDER');--> statement-breakpoint
CREATE TYPE "timesheets"."invoice_status" AS ENUM('DRAFT', 'ISSUED', 'PAID', 'VOID');--> statement-breakpoint
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
CREATE TABLE "timesheets"."internal_approver_assignment" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"submitter_user_id" text NOT NULL,
	"approver_user_id" text NOT NULL,
	"created_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheets"."invoice" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"client_organization_id" text,
	"number" text NOT NULL,
	"status" "timesheets"."invoice_status" DEFAULT 'DRAFT' NOT NULL,
	"currency" text NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date NOT NULL,
	"subject" text,
	"notes" text,
	"sender_name" text NOT NULL,
	"sender_logo" text,
	"sender_address" text NOT NULL,
	"sender_registration" text,
	"sender_vat_number" text,
	"sender_iban" text,
	"sender_bic" text,
	"recipient_name" text NOT NULL,
	"recipient_address" text NOT NULL,
	"recipient_contact_name" text,
	"recipient_email" text,
	"recipient_locale" text DEFAULT 'nl' NOT NULL,
	"created_by_id" text NOT NULL,
	"issued_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheets"."invoice_attachment" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"content_base64" text NOT NULL,
	"uploaded_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheets"."invoice_email_delivery" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"status" "timesheets"."invoice_email_delivery_status" DEFAULT 'PENDING' NOT NULL,
	"purpose" "timesheets"."invoice_email_purpose" DEFAULT 'INVOICE' NOT NULL,
	"recipient_email" text NOT NULL,
	"cc_emails" text DEFAULT '[]' NOT NULL,
	"locale" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"provider_message_id" text,
	"provider_last_event" text,
	"provider_status_checked_at" timestamp,
	"error_message" text,
	"payload_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "timesheets"."invoice_history" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"action" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"amount_minor" integer,
	"attachment_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheets"."invoice_line" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"position" integer NOT NULL,
	"description" text NOT NULL,
	"quantity_milli" integer NOT NULL,
	"unit" text DEFAULT 'hour' NOT NULL,
	"unit_price_minor" integer NOT NULL,
	"vat_rate_basis_points" integer DEFAULT 2100 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheets"."invoice_payment" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"paid_on" date NOT NULL,
	"amount_minor" integer NOT NULL,
	"reference" text,
	"note" text,
	"created_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheets"."invoice_time_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"invoice_line_id" text NOT NULL,
	"time_entry_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheets"."organization_contact" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"job_title" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheets"."organization_invoice_profile" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"registration_number" text,
	"vat_number" text,
	"iban" text,
	"bic" text,
	"invoice_email" text,
	"invoice_email_template" text,
	"preferred_locale" text DEFAULT 'nl' NOT NULL,
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
CREATE TABLE "timesheets"."team_member_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"can_enter_time" boolean DEFAULT true NOT NULL,
	"internal_approval_required" boolean DEFAULT true NOT NULL,
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
	"client_organization_id" text NOT NULL,
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
CREATE TABLE "timesheets"."client_review" (
	"id" text PRIMARY KEY NOT NULL,
	"weekly_timesheet_id" text NOT NULL,
	"client_organization_id" text NOT NULL,
	"status" "timesheets"."client_review_status" DEFAULT 'PENDING' NOT NULL,
	"reviewer_user_id" text,
	"comment" text,
	"version" integer DEFAULT 1 NOT NULL,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheets"."client_review_history" (
	"id" text PRIMARY KEY NOT NULL,
	"weekly_timesheet_id" text NOT NULL,
	"client_organization_id" text NOT NULL,
	"action" "timesheets"."client_review_action" NOT NULL,
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
	"status" timesheet_status DEFAULT 'DRAFT' NOT NULL,
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
	"access_mode" "timesheets"."client_access_mode" DEFAULT 'DISABLED' NOT NULL,
	"invoice_access_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheets"."workspace_client_invoice_viewer" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_client_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheets"."workspace_client_reviewer" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_client_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheets"."workspace_settings" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"timezone" text DEFAULT 'Europe/Amsterdam' NOT NULL,
	"default_vat_rate_basis_points" integer DEFAULT 2100 NOT NULL,
	"week_starts_on" integer DEFAULT 1 NOT NULL,
	"workspace_enabled" boolean DEFAULT false NOT NULL,
	"invoicing_enabled" boolean DEFAULT false NOT NULL,
	"internal_approvals_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "timesheets"."activity_type" ADD CONSTRAINT "activity_type_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."internal_approver_assignment" ADD CONSTRAINT "internal_approver_assignment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."internal_approver_assignment" ADD CONSTRAINT "internal_approver_assignment_submitter_user_id_user_id_fk" FOREIGN KEY ("submitter_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."internal_approver_assignment" ADD CONSTRAINT "internal_approver_assignment_approver_user_id_user_id_fk" FOREIGN KEY ("approver_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."internal_approver_assignment" ADD CONSTRAINT "internal_approver_assignment_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."invoice" ADD CONSTRAINT "invoice_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."invoice" ADD CONSTRAINT "invoice_client_organization_id_organization_id_fk" FOREIGN KEY ("client_organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."invoice" ADD CONSTRAINT "invoice_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."invoice_attachment" ADD CONSTRAINT "invoice_attachment_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "timesheets"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."invoice_attachment" ADD CONSTRAINT "invoice_attachment_uploaded_by_id_user_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."invoice_email_delivery" ADD CONSTRAINT "invoice_email_delivery_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "timesheets"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."invoice_email_delivery" ADD CONSTRAINT "invoice_email_delivery_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."invoice_history" ADD CONSTRAINT "invoice_history_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "timesheets"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."invoice_history" ADD CONSTRAINT "invoice_history_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."invoice_line" ADD CONSTRAINT "invoice_line_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "timesheets"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."invoice_payment" ADD CONSTRAINT "invoice_payment_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "timesheets"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."invoice_payment" ADD CONSTRAINT "invoice_payment_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."invoice_time_entry" ADD CONSTRAINT "invoice_time_entry_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "timesheets"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."invoice_time_entry" ADD CONSTRAINT "invoice_time_entry_invoice_line_id_invoice_line_id_fk" FOREIGN KEY ("invoice_line_id") REFERENCES "timesheets"."invoice_line"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."invoice_time_entry" ADD CONSTRAINT "invoice_time_entry_time_entry_id_time_entry_id_fk" FOREIGN KEY ("time_entry_id") REFERENCES "timesheets"."time_entry"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."organization_contact" ADD CONSTRAINT "organization_contact_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."organization_contact" ADD CONSTRAINT "organization_contact_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."organization_invoice_profile" ADD CONSTRAINT "organization_invoice_profile_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."project" ADD CONSTRAINT "project_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."project" ADD CONSTRAINT "project_client_organization_id_organization_id_fk" FOREIGN KEY ("client_organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."project_activity" ADD CONSTRAINT "project_activity_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "timesheets"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."project_activity" ADD CONSTRAINT "project_activity_activity_type_id_activity_type_id_fk" FOREIGN KEY ("activity_type_id") REFERENCES "timesheets"."activity_type"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."project_person_tariff" ADD CONSTRAINT "project_person_tariff_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "timesheets"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."project_person_tariff" ADD CONSTRAINT "project_person_tariff_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."team_member_settings" ADD CONSTRAINT "team_member_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."team_member_settings" ADD CONSTRAINT "team_member_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."team_tariff" ADD CONSTRAINT "team_tariff_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."team_tariff" ADD CONSTRAINT "team_tariff_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."time_entry" ADD CONSTRAINT "time_entry_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."time_entry" ADD CONSTRAINT "time_entry_weekly_timesheet_id_weekly_timesheet_id_fk" FOREIGN KEY ("weekly_timesheet_id") REFERENCES "timesheets"."weekly_timesheet"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."time_entry" ADD CONSTRAINT "time_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."time_entry" ADD CONSTRAINT "time_entry_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "timesheets"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."time_entry" ADD CONSTRAINT "time_entry_client_organization_id_organization_id_fk" FOREIGN KEY ("client_organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."time_entry" ADD CONSTRAINT "time_entry_activity_type_id_activity_type_id_fk" FOREIGN KEY ("activity_type_id") REFERENCES "timesheets"."activity_type"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."approval_history" ADD CONSTRAINT "approval_history_weekly_timesheet_id_weekly_timesheet_id_fk" FOREIGN KEY ("weekly_timesheet_id") REFERENCES "timesheets"."weekly_timesheet"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."approval_history" ADD CONSTRAINT "approval_history_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."client_review" ADD CONSTRAINT "client_review_weekly_timesheet_id_weekly_timesheet_id_fk" FOREIGN KEY ("weekly_timesheet_id") REFERENCES "timesheets"."weekly_timesheet"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."client_review" ADD CONSTRAINT "client_review_client_organization_id_organization_id_fk" FOREIGN KEY ("client_organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."client_review" ADD CONSTRAINT "client_review_reviewer_user_id_user_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."client_review_history" ADD CONSTRAINT "client_review_history_weekly_timesheet_id_weekly_timesheet_id_fk" FOREIGN KEY ("weekly_timesheet_id") REFERENCES "timesheets"."weekly_timesheet"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."client_review_history" ADD CONSTRAINT "client_review_history_client_organization_id_organization_id_fk" FOREIGN KEY ("client_organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."client_review_history" ADD CONSTRAINT "client_review_history_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."weekly_timesheet" ADD CONSTRAINT "weekly_timesheet_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."weekly_timesheet" ADD CONSTRAINT "weekly_timesheet_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."weekly_timesheet" ADD CONSTRAINT "weekly_timesheet_reviewed_by_id_user_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."workspace_client" ADD CONSTRAINT "workspace_client_workspace_organization_id_organization_id_fk" FOREIGN KEY ("workspace_organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."workspace_client" ADD CONSTRAINT "workspace_client_client_organization_id_organization_id_fk" FOREIGN KEY ("client_organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."workspace_client_invoice_viewer" ADD CONSTRAINT "workspace_client_invoice_viewer_workspace_client_id_workspace_client_id_fk" FOREIGN KEY ("workspace_client_id") REFERENCES "timesheets"."workspace_client"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."workspace_client_invoice_viewer" ADD CONSTRAINT "workspace_client_invoice_viewer_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."workspace_client_invoice_viewer" ADD CONSTRAINT "workspace_client_invoice_viewer_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."workspace_client_reviewer" ADD CONSTRAINT "workspace_client_reviewer_workspace_client_id_workspace_client_id_fk" FOREIGN KEY ("workspace_client_id") REFERENCES "timesheets"."workspace_client"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."workspace_client_reviewer" ADD CONSTRAINT "workspace_client_reviewer_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."workspace_client_reviewer" ADD CONSTRAINT "workspace_client_reviewer_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets"."workspace_settings" ADD CONSTRAINT "workspace_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activity_type_org_name_uidx" ON "timesheets"."activity_type" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "activity_type_org_idx" ON "timesheets"."activity_type" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "internal_approver_assignment_org_submitter_approver_uidx" ON "timesheets"."internal_approver_assignment" USING btree ("organization_id","submitter_user_id","approver_user_id");--> statement-breakpoint
CREATE INDEX "internal_approver_assignment_approver_idx" ON "timesheets"."internal_approver_assignment" USING btree ("organization_id","approver_user_id");--> statement-breakpoint
CREATE INDEX "internal_approver_assignment_submitter_idx" ON "timesheets"."internal_approver_assignment" USING btree ("organization_id","submitter_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_org_number_uidx" ON "timesheets"."invoice" USING btree ("organization_id","number");--> statement-breakpoint
CREATE INDEX "invoice_org_status_idx" ON "timesheets"."invoice" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "invoice_client_idx" ON "timesheets"."invoice" USING btree ("client_organization_id");--> statement-breakpoint
CREATE INDEX "invoice_attachment_invoice_idx" ON "timesheets"."invoice_attachment" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_email_delivery_invoice_idx" ON "timesheets"."invoice_email_delivery" USING btree ("invoice_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_email_delivery_pending_invoice_uidx" ON "timesheets"."invoice_email_delivery" USING btree ("invoice_id") WHERE "timesheets"."invoice_email_delivery"."status" = 'PENDING';--> statement-breakpoint
CREATE INDEX "invoice_history_invoice_idx" ON "timesheets"."invoice_history" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_line_invoice_idx" ON "timesheets"."invoice_line" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_payment_invoice_idx" ON "timesheets"."invoice_payment" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_time_entry_entry_idx" ON "timesheets"."invoice_time_entry" USING btree ("time_entry_id");--> statement-breakpoint
CREATE INDEX "invoice_time_entry_invoice_idx" ON "timesheets"."invoice_time_entry" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "organization_contact_org_idx" ON "timesheets"."organization_contact" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_contact_org_email_uidx" ON "timesheets"."organization_contact" USING btree ("organization_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "project_org_name_uidx" ON "timesheets"."project" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "project_org_status_idx" ON "timesheets"."project" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "project_client_idx" ON "timesheets"."project" USING btree ("client_organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_activity_project_activity_uidx" ON "timesheets"."project_activity" USING btree ("project_id","activity_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_person_tariff_project_user_uidx" ON "timesheets"."project_person_tariff" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_member_settings_org_user_uidx" ON "timesheets"."team_member_settings" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_tariff_org_user_uidx" ON "timesheets"."team_tariff" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "time_entry_org_user_date_idx" ON "timesheets"."time_entry" USING btree ("organization_id","user_id","entry_date");--> statement-breakpoint
CREATE INDEX "time_entry_week_idx" ON "timesheets"."time_entry" USING btree ("weekly_timesheet_id");--> statement-breakpoint
CREATE INDEX "time_entry_project_idx" ON "timesheets"."time_entry" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "time_entry_client_idx" ON "timesheets"."time_entry" USING btree ("client_organization_id");--> statement-breakpoint
CREATE INDEX "approval_history_week_idx" ON "timesheets"."approval_history" USING btree ("weekly_timesheet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "client_review_week_client_uidx" ON "timesheets"."client_review" USING btree ("weekly_timesheet_id","client_organization_id");--> statement-breakpoint
CREATE INDEX "client_review_client_status_idx" ON "timesheets"."client_review" USING btree ("client_organization_id","status");--> statement-breakpoint
CREATE INDEX "client_review_history_week_client_idx" ON "timesheets"."client_review_history" USING btree ("weekly_timesheet_id","client_organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_timesheet_org_user_week_uidx" ON "timesheets"."weekly_timesheet" USING btree ("organization_id","user_id","week_starts_on");--> statement-breakpoint
CREATE INDEX "weekly_timesheet_org_status_idx" ON "timesheets"."weekly_timesheet" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_client_workspace_client_uidx" ON "timesheets"."workspace_client" USING btree ("workspace_organization_id","client_organization_id");--> statement-breakpoint
CREATE INDEX "workspace_client_workspace_idx" ON "timesheets"."workspace_client" USING btree ("workspace_organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_client_invoice_viewer_link_user_uidx" ON "timesheets"."workspace_client_invoice_viewer" USING btree ("workspace_client_id","user_id");--> statement-breakpoint
CREATE INDEX "workspace_client_invoice_viewer_user_idx" ON "timesheets"."workspace_client_invoice_viewer" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_client_reviewer_link_user_uidx" ON "timesheets"."workspace_client_reviewer" USING btree ("workspace_client_id","user_id");--> statement-breakpoint
CREATE INDEX "workspace_client_reviewer_user_idx" ON "timesheets"."workspace_client_reviewer" USING btree ("user_id");