CREATE TYPE "timesheets"."invoice_email_purpose" AS ENUM('INVOICE', 'REMINDER');
ALTER TABLE "timesheets"."invoice_email_delivery" ADD COLUMN "purpose" "timesheets"."invoice_email_purpose" DEFAULT 'INVOICE' NOT NULL;
