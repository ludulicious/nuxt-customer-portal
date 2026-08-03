ALTER TABLE "service_request" RENAME COLUMN "organizationId" TO "organization_id";--> statement-breakpoint
ALTER TABLE "service_request" RENAME COLUMN "createdById" TO "created_by_id";--> statement-breakpoint
ALTER TABLE "service_request" RENAME COLUMN "assignedToId" TO "assigned_to_id";--> statement-breakpoint
ALTER TABLE "service_request" RENAME COLUMN "internalNotes" TO "internal_notes";--> statement-breakpoint
ALTER TABLE "service_request" RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE "service_request" RENAME COLUMN "updatedAt" TO "updated_at";--> statement-breakpoint
ALTER TABLE "service_request" RENAME COLUMN "resolvedAt" TO "resolved_at";--> statement-breakpoint
ALTER TABLE "service_request" RENAME COLUMN "closedAt" TO "closed_at";--> statement-breakpoint
DROP INDEX "service_request_organization_id_idx";--> statement-breakpoint
DROP INDEX "service_request_created_by_id_idx";--> statement-breakpoint
DROP INDEX "service_request_assigned_to_id_idx";--> statement-breakpoint
DROP INDEX "service_request_created_at_idx";--> statement-breakpoint
ALTER TABLE "service_request" ADD CONSTRAINT "service_request_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request" ADD CONSTRAINT "service_request_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request" ADD CONSTRAINT "service_request_assigned_to_id_user_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_request_organization_id_idx" ON "service_request" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "service_request_created_by_id_idx" ON "service_request" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "service_request_assigned_to_id_idx" ON "service_request" USING btree ("assigned_to_id");--> statement-breakpoint
CREATE INDEX "service_request_created_at_idx" ON "service_request" USING btree ("created_at");