CREATE TABLE "timesheets"."organization_invoice_profile" (
  "organization_id" text PRIMARY KEY REFERENCES "organization"("id") ON DELETE cascade,
  "address" text DEFAULT '' NOT NULL, "registration_number" text, "vat_number" text,
  "iban" text, "bic" text, "invoice_email" text,
  "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "timesheets"."organization_contact" (
  "id" text PRIMARY KEY, "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE cascade,
  "user_id" text REFERENCES "user"("id") ON DELETE set null, "name" text NOT NULL, "email" text NOT NULL,
  "phone" text, "job_title" text, "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "organization_contact_org_idx" ON "timesheets"."organization_contact" ("organization_id");
CREATE UNIQUE INDEX "organization_contact_org_email_uidx" ON "timesheets"."organization_contact" ("organization_id", "email");
