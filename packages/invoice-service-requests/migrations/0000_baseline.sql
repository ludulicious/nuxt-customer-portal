CREATE SCHEMA IF NOT EXISTS "invoice_service_requests";
CREATE TABLE "invoice_service_requests"."invoice_service_request" (
  "id" text PRIMARY KEY, "request_id" text NOT NULL REFERENCES "service_requests"."service_request"("id") ON DELETE restrict,
  "quote_id" text REFERENCES "service_requests"."service_request_quote"("id") ON DELETE restrict,
  "invoice_id" text NOT NULL REFERENCES "invoices"."invoice"("id") ON DELETE cascade, "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "invoice_service_request_request_uidx" ON "invoice_service_requests"."invoice_service_request" ("request_id");
CREATE UNIQUE INDEX "invoice_service_request_invoice_uidx" ON "invoice_service_requests"."invoice_service_request" ("invoice_id");
CREATE INDEX "invoice_service_request_quote_idx" ON "invoice_service_requests"."invoice_service_request" ("quote_id");
