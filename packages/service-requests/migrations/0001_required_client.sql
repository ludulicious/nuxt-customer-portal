-- Existing requests are intentionally not migrated: the legacy model has no reliable client relationship.
CREATE TABLE IF NOT EXISTS "service_requests"."legacy_service_request" AS
  TABLE "service_requests"."service_request" WITH DATA;
TRUNCATE TABLE "service_requests"."service_request" CASCADE;
ALTER TABLE "service_requests"."service_request" ADD COLUMN IF NOT EXISTS "client_organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE restrict;
CREATE INDEX IF NOT EXISTS "service_request_client_organization_id_idx" ON "service_requests"."service_request" ("client_organization_id");
