CREATE SCHEMA "service_requests";
--> statement-breakpoint
CREATE TYPE "service_requests"."ServiceRequestPriority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT');--> statement-breakpoint
CREATE TYPE "service_requests"."ServiceRequestStatus" AS ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');--> statement-breakpoint
CREATE TABLE "service_requests"."service_request" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" "service_requests"."ServiceRequestStatus" DEFAULT 'OPEN' NOT NULL,
	"priority" "service_requests"."ServiceRequestPriority" DEFAULT 'MEDIUM' NOT NULL,
	"category" text,
	"organization_id" text NOT NULL,
	"created_by_id" text NOT NULL,
	"assigned_to_id" text,
	"attachments" jsonb,
	"internal_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"closed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "service_requests"."service_request" ADD CONSTRAINT "service_request_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests"."service_request" ADD CONSTRAINT "service_request_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests"."service_request" ADD CONSTRAINT "service_request_assigned_to_id_user_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_request_organization_id_idx" ON "service_requests"."service_request" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "service_request_created_by_id_idx" ON "service_requests"."service_request" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "service_request_assigned_to_id_idx" ON "service_requests"."service_request" USING btree ("assigned_to_id");--> statement-breakpoint
CREATE INDEX "service_request_status_idx" ON "service_requests"."service_request" USING btree ("status");--> statement-breakpoint
CREATE INDEX "service_request_created_at_idx" ON "service_requests"."service_request" USING btree ("created_at");