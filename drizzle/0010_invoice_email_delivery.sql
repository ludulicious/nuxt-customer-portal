CREATE TYPE "timesheets"."invoice_email_delivery_status" AS ENUM('PENDING', 'SENT', 'FAILED');
ALTER TABLE "timesheets"."organization_invoice_profile" ADD COLUMN "preferred_locale" text DEFAULT 'nl' NOT NULL;
ALTER TABLE "timesheets"."invoice" ADD COLUMN "recipient_locale" text DEFAULT 'nl' NOT NULL;
CREATE TABLE "timesheets"."invoice_email_delivery" (
  "id" text PRIMARY KEY,
  "invoice_id" text NOT NULL REFERENCES "timesheets"."invoice"("id") ON DELETE cascade,
  "status" "timesheets"."invoice_email_delivery_status" DEFAULT 'PENDING' NOT NULL,
  "recipient_email" text NOT NULL,
  "cc_emails" text DEFAULT '[]' NOT NULL,
  "locale" text NOT NULL,
  "subject" text NOT NULL,
  "body" text NOT NULL,
  "actor_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE restrict,
  "provider_message_id" text,
  "error_message" text,
  "payload_hash" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "sent_at" timestamp
);
CREATE INDEX "invoice_email_delivery_invoice_idx" ON "timesheets"."invoice_email_delivery" ("invoice_id", "created_at");
CREATE UNIQUE INDEX "invoice_email_delivery_pending_invoice_uidx" ON "timesheets"."invoice_email_delivery" ("invoice_id") WHERE "status" = 'PENDING';
