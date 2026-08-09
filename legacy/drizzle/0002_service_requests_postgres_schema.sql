CREATE SCHEMA "service_requests";
--> statement-breakpoint
ALTER TYPE "public"."ServiceRequestPriority" SET SCHEMA "service_requests";--> statement-breakpoint
ALTER TYPE "public"."ServiceRequestStatus" SET SCHEMA "service_requests";--> statement-breakpoint
ALTER TABLE "public"."service_request" SET SCHEMA "service_requests";
