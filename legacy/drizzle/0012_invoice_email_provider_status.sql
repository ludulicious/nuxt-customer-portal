ALTER TABLE "timesheets"."invoice_email_delivery"
  ADD COLUMN "provider_last_event" text,
  ADD COLUMN "provider_status_checked_at" timestamp;
