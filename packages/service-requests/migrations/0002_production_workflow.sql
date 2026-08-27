ALTER TYPE "service_requests"."ServiceRequestStatus" RENAME VALUE 'OPEN' TO 'NEW';
ALTER TYPE "service_requests"."ServiceRequestStatus" RENAME VALUE 'RESOLVED' TO 'COMPLETED';
ALTER TYPE "service_requests"."ServiceRequestStatus" ADD VALUE 'EVALUATING';
ALTER TYPE "service_requests"."ServiceRequestStatus" ADD VALUE 'AWAITING_APPROVAL';
ALTER TYPE "service_requests"."ServiceRequestStatus" ADD VALUE 'ACCEPTED';
ALTER TYPE "service_requests"."ServiceRequestStatus" ADD VALUE 'DECLINED';
ALTER TYPE "service_requests"."ServiceRequestStatus" ADD VALUE 'CANCELLED';
ALTER TABLE "service_requests"."service_request" ALTER COLUMN "status" DROP DEFAULT;
UPDATE "service_requests"."service_request" SET "status" = 'COMPLETED' WHERE "status"::text = 'CLOSED';
ALTER TABLE "service_requests"."service_request" ALTER COLUMN "status" SET DEFAULT 'NEW';

ALTER TABLE "service_requests"."service_request" ADD COLUMN IF NOT EXISTS "contact_name" text;
ALTER TABLE "service_requests"."service_request" ADD COLUMN IF NOT EXISTS "contact_email" text;
ALTER TABLE "service_requests"."service_request" ADD COLUMN IF NOT EXISTS "contact_phone" text;
ALTER TABLE "service_requests"."service_request" ADD COLUMN IF NOT EXISTS "requested_date" date;
ALTER TABLE "service_requests"."service_request" ADD COLUMN IF NOT EXISTS "service_location" text;
ALTER TABLE "service_requests"."service_request" ADD COLUMN IF NOT EXISTS "evaluating_at" timestamp;
ALTER TABLE "service_requests"."service_request" ADD COLUMN IF NOT EXISTS "accepted_at" timestamp;
ALTER TABLE "service_requests"."service_request" ADD COLUMN IF NOT EXISTS "started_at" timestamp;
ALTER TABLE "service_requests"."service_request" ADD COLUMN IF NOT EXISTS "completed_at" timestamp;
ALTER TABLE "service_requests"."service_request" ADD COLUMN IF NOT EXISTS "declined_at" timestamp;
ALTER TABLE "service_requests"."service_request" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp;
CREATE INDEX IF NOT EXISTS "service_request_requested_date_idx" ON "service_requests"."service_request" ("organization_id", "requested_date");

CREATE TYPE "service_requests"."service_request_activity_type" AS ENUM ('CREATED','COMMENT','STATUS_CHANGED','ASSIGNED','DETAILS_UPDATED','ATTACHMENT_ADDED','ATTACHMENT_REMOVED','QUOTE_SENT','QUOTE_ACCEPTED','QUOTE_DECLINED','INVOICE_CREATED');
CREATE TYPE "service_requests"."service_request_quote_status" AS ENUM ('DRAFT','SENT','ACCEPTED','DECLINED','SUPERSEDED','EXPIRED');
CREATE TABLE "service_requests"."service_request_activity" (
  "id" text PRIMARY KEY, "request_id" text NOT NULL REFERENCES "service_requests"."service_request"("id") ON DELETE cascade,
  "type" "service_requests"."service_request_activity_type" NOT NULL, "actor_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE restrict,
  "body" text, "metadata" text, "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "service_request_activity_request_created_idx" ON "service_requests"."service_request_activity" ("request_id", "created_at");
INSERT INTO "service_requests"."service_request_activity" ("id","request_id","type","actor_user_id","created_at")
SELECT 'migrated-' || "id", "id", 'CREATED', "created_by_id", "created_at" FROM "service_requests"."service_request";

CREATE TABLE "service_requests"."service_request_attachment" (
  "id" text PRIMARY KEY, "request_id" text NOT NULL REFERENCES "service_requests"."service_request"("id") ON DELETE cascade,
  "file_name" text NOT NULL, "content_type" text NOT NULL, "size" integer NOT NULL, "content_base64" text NOT NULL,
  "uploaded_by_id" text NOT NULL REFERENCES "user"("id") ON DELETE restrict, "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "service_request_attachment_request_idx" ON "service_requests"."service_request_attachment" ("request_id");

CREATE TABLE "service_requests"."service_request_quote" (
  "id" text PRIMARY KEY, "request_id" text NOT NULL REFERENCES "service_requests"."service_request"("id") ON DELETE restrict,
  "version" integer NOT NULL, "number" text NOT NULL, "status" "service_requests"."service_request_quote_status" DEFAULT 'DRAFT' NOT NULL,
  "currency" text DEFAULT 'EUR' NOT NULL, "valid_until" date NOT NULL, "notes" text,
  "created_by_id" text NOT NULL REFERENCES "user"("id") ON DELETE restrict, "sent_at" timestamp, "accepted_at" timestamp,
  "accepted_by_id" text REFERENCES "user"("id") ON DELETE restrict, "declined_at" timestamp,
  "declined_by_id" text REFERENCES "user"("id") ON DELETE restrict, "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "service_request_quote_request_version_uidx" ON "service_requests"."service_request_quote" ("request_id", "version");
CREATE UNIQUE INDEX "service_request_quote_number_uidx" ON "service_requests"."service_request_quote" ("number");
CREATE INDEX "service_request_quote_request_idx" ON "service_requests"."service_request_quote" ("request_id");
CREATE TABLE "service_requests"."service_request_quote_line" (
  "id" text PRIMARY KEY, "quote_id" text NOT NULL REFERENCES "service_requests"."service_request_quote"("id") ON DELETE cascade,
  "position" integer NOT NULL, "description" text NOT NULL, "quantity_milli" integer NOT NULL, "unit" text NOT NULL,
  "unit_price_minor" integer NOT NULL, "vat_rate_basis_points" integer NOT NULL
);
CREATE UNIQUE INDEX "service_request_quote_line_position_uidx" ON "service_requests"."service_request_quote_line" ("quote_id", "position");
CREATE INDEX "service_request_quote_line_quote_idx" ON "service_requests"."service_request_quote_line" ("quote_id");
