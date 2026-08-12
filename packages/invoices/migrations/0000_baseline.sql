CREATE SCHEMA "invoices";
--> statement-breakpoint
CREATE TYPE "invoices"."invoice_email_delivery_status" AS ENUM('PENDING', 'SENT', 'FAILED');--> statement-breakpoint
CREATE TYPE "invoices"."invoice_email_purpose" AS ENUM('INVOICE', 'REMINDER');--> statement-breakpoint
CREATE TYPE "invoices"."invoice_status" AS ENUM('DRAFT', 'ISSUED', 'PAID', 'VOID');--> statement-breakpoint
CREATE TABLE "invoices"."billing_contact" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"job_title" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices"."invoice" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"client_organization_id" text,
	"number" text NOT NULL,
	"status" "invoices"."invoice_status" DEFAULT 'DRAFT' NOT NULL,
	"currency" text NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date NOT NULL,
	"subject" text,
	"notes" text,
	"sender_name" text NOT NULL,
	"sender_logo" text,
	"sender_address" text NOT NULL,
	"sender_registration" text,
	"sender_vat_number" text,
	"sender_iban" text,
	"sender_bic" text,
	"recipient_name" text NOT NULL,
	"recipient_address" text NOT NULL,
	"recipient_contact_name" text,
	"recipient_email" text,
	"recipient_locale" text DEFAULT 'nl' NOT NULL,
	"created_by_id" text NOT NULL,
	"issued_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices"."invoice_attachment" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"content_base64" text NOT NULL,
	"uploaded_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices"."client_access" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_organization_id" text NOT NULL,
	"client_organization_id" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices"."client_viewer" (
	"id" text PRIMARY KEY NOT NULL,
	"access_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices"."invoice_email_delivery" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"status" "invoices"."invoice_email_delivery_status" DEFAULT 'PENDING' NOT NULL,
	"purpose" "invoices"."invoice_email_purpose" DEFAULT 'INVOICE' NOT NULL,
	"recipient_email" text NOT NULL,
	"cc_emails" text DEFAULT '[]' NOT NULL,
	"locale" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"provider_message_id" text,
	"provider_last_event" text,
	"provider_status_checked_at" timestamp,
	"error_message" text,
	"payload_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "invoices"."invoice_history" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"action" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"amount_minor" integer,
	"attachment_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices"."invoice_line" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"position" integer NOT NULL,
	"description" text NOT NULL,
	"quantity_milli" integer NOT NULL,
	"unit" text DEFAULT 'item' NOT NULL,
	"unit_price_minor" integer NOT NULL,
	"vat_rate_basis_points" integer DEFAULT 2100 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices"."invoice_payment" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"paid_on" date NOT NULL,
	"amount_minor" integer NOT NULL,
	"reference" text,
	"note" text,
	"created_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices"."settings" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"default_vat_rate_basis_points" integer DEFAULT 2100 NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"registration_number" text,
	"vat_number" text,
	"iban" text,
	"bic" text,
	"invoice_email" text,
	"invoice_email_template" text,
	"preferred_locale" text DEFAULT 'nl' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoices"."billing_contact" ADD CONSTRAINT "billing_contact_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices"."billing_contact" ADD CONSTRAINT "billing_contact_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices"."invoice" ADD CONSTRAINT "invoice_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices"."invoice" ADD CONSTRAINT "invoice_client_organization_id_organization_id_fk" FOREIGN KEY ("client_organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices"."invoice" ADD CONSTRAINT "invoice_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices"."invoice_attachment" ADD CONSTRAINT "invoice_attachment_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "invoices"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices"."invoice_attachment" ADD CONSTRAINT "invoice_attachment_uploaded_by_id_user_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices"."client_access" ADD CONSTRAINT "client_access_provider_organization_id_organization_id_fk" FOREIGN KEY ("provider_organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices"."client_access" ADD CONSTRAINT "client_access_client_organization_id_organization_id_fk" FOREIGN KEY ("client_organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices"."client_viewer" ADD CONSTRAINT "client_viewer_access_id_client_access_id_fk" FOREIGN KEY ("access_id") REFERENCES "invoices"."client_access"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices"."client_viewer" ADD CONSTRAINT "client_viewer_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices"."client_viewer" ADD CONSTRAINT "client_viewer_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices"."invoice_email_delivery" ADD CONSTRAINT "invoice_email_delivery_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "invoices"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices"."invoice_email_delivery" ADD CONSTRAINT "invoice_email_delivery_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices"."invoice_history" ADD CONSTRAINT "invoice_history_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "invoices"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices"."invoice_history" ADD CONSTRAINT "invoice_history_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices"."invoice_line" ADD CONSTRAINT "invoice_line_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "invoices"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices"."invoice_payment" ADD CONSTRAINT "invoice_payment_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "invoices"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices"."invoice_payment" ADD CONSTRAINT "invoice_payment_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices"."settings" ADD CONSTRAINT "settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_contact_org_email_uidx" ON "invoices"."billing_contact" USING btree ("organization_id","email");--> statement-breakpoint
CREATE INDEX "billing_contact_org_idx" ON "invoices"."billing_contact" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_org_number_uidx" ON "invoices"."invoice" USING btree ("organization_id","number");--> statement-breakpoint
CREATE INDEX "invoice_org_status_idx" ON "invoices"."invoice" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "invoice_client_idx" ON "invoices"."invoice" USING btree ("client_organization_id");--> statement-breakpoint
CREATE INDEX "invoice_attachment_invoice_idx" ON "invoices"."invoice_attachment" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_client_access_provider_client_uidx" ON "invoices"."client_access" USING btree ("provider_organization_id","client_organization_id");--> statement-breakpoint
CREATE INDEX "invoice_client_access_client_idx" ON "invoices"."client_access" USING btree ("client_organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_client_viewer_access_user_uidx" ON "invoices"."client_viewer" USING btree ("access_id","user_id");--> statement-breakpoint
CREATE INDEX "invoice_client_viewer_user_idx" ON "invoices"."client_viewer" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invoice_email_delivery_invoice_idx" ON "invoices"."invoice_email_delivery" USING btree ("invoice_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_email_delivery_pending_invoice_uidx" ON "invoices"."invoice_email_delivery" USING btree ("invoice_id") WHERE "invoices"."invoice_email_delivery"."status" = 'PENDING';--> statement-breakpoint
CREATE INDEX "invoice_history_invoice_idx" ON "invoices"."invoice_history" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_line_invoice_idx" ON "invoices"."invoice_line" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_payment_invoice_idx" ON "invoices"."invoice_payment" USING btree ("invoice_id");--> statement-breakpoint
DO $$ BEGIN
  IF to_regclass('timesheets.workspace_settings') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'timesheets' AND table_name = 'workspace_settings' AND column_name = 'invoicing_enabled') THEN
    INSERT INTO invoices.settings (organization_id, enabled, currency, default_vat_rate_basis_points, address, registration_number, vat_number, iban, bic, invoice_email, invoice_email_template, preferred_locale, created_at, updated_at)
    SELECT ws.organization_id, ws.invoicing_enabled, ws.currency, ws.default_vat_rate_basis_points, COALESCE(p.address, ''), p.registration_number, p.vat_number, p.iban, p.bic, p.invoice_email, p.invoice_email_template, COALESCE(p.preferred_locale, 'nl'), ws.created_at, ws.updated_at
    FROM timesheets.workspace_settings ws LEFT JOIN timesheets.organization_invoice_profile p ON p.organization_id = ws.organization_id ON CONFLICT (organization_id) DO NOTHING;
  END IF;
  IF to_regclass('timesheets.organization_contact') IS NOT NULL THEN INSERT INTO invoices.billing_contact SELECT * FROM timesheets.organization_contact ON CONFLICT (id) DO NOTHING; END IF;
  IF to_regclass('timesheets.workspace_client') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'timesheets' AND table_name = 'workspace_client' AND column_name = 'invoice_access_enabled') THEN
    INSERT INTO invoices.client_access (id, provider_organization_id, client_organization_id, enabled, created_at, updated_at) SELECT id, workspace_organization_id, client_organization_id, invoice_access_enabled, created_at, updated_at FROM timesheets.workspace_client WHERE invoice_access_enabled ON CONFLICT (id) DO NOTHING;
    INSERT INTO clients.client_module (id, organization_id, module_id, enabled, enabled_at, created_at, updated_at) SELECT 'invoice-' || id, client_organization_id, 'invoices', true, created_at, created_at, updated_at FROM timesheets.workspace_client WHERE invoice_access_enabled ON CONFLICT (organization_id, module_id) DO UPDATE SET enabled = true, disabled_at = NULL, updated_at = EXCLUDED.updated_at;
  END IF;
  IF to_regclass('timesheets.workspace_client_invoice_viewer') IS NOT NULL THEN INSERT INTO invoices.client_viewer (id, access_id, user_id, created_by_id, created_at) SELECT id, workspace_client_id, user_id, created_by_id, created_at FROM timesheets.workspace_client_invoice_viewer ON CONFLICT (id) DO NOTHING; END IF;
  IF to_regclass('timesheets.invoice') IS NOT NULL THEN
    INSERT INTO invoices.invoice SELECT id, organization_id, client_organization_id, number, status::text::invoices.invoice_status, currency, issue_date, due_date, subject, notes, sender_name, sender_logo, sender_address, sender_registration, sender_vat_number, sender_iban, sender_bic, recipient_name, recipient_address, recipient_contact_name, recipient_email, recipient_locale, created_by_id, issued_at, created_at, updated_at FROM timesheets.invoice ON CONFLICT (id) DO NOTHING;
    INSERT INTO invoices.invoice_line SELECT * FROM timesheets.invoice_line ON CONFLICT (id) DO NOTHING;
    INSERT INTO invoices.invoice_payment SELECT * FROM timesheets.invoice_payment ON CONFLICT (id) DO NOTHING;
    INSERT INTO invoices.invoice_history SELECT * FROM timesheets.invoice_history ON CONFLICT (id) DO NOTHING;
    INSERT INTO invoices.invoice_attachment SELECT * FROM timesheets.invoice_attachment ON CONFLICT (id) DO NOTHING;
    INSERT INTO invoices.invoice_email_delivery SELECT id, invoice_id, status::text::invoices.invoice_email_delivery_status, purpose::text::invoices.invoice_email_purpose, recipient_email, cc_emails, locale, subject, body, actor_user_id, provider_message_id, provider_last_event, provider_status_checked_at, error_message, payload_hash, created_at, updated_at, sent_at FROM timesheets.invoice_email_delivery ON CONFLICT (id) DO NOTHING;

    CREATE TABLE IF NOT EXISTS invoices._legacy_timesheet_source (id text PRIMARY KEY, invoice_id text NOT NULL, invoice_line_id text NOT NULL, time_entry_id text NOT NULL);
    INSERT INTO invoices._legacy_timesheet_source SELECT * FROM timesheets.invoice_time_entry ON CONFLICT (id) DO NOTHING;

    IF EXISTS (SELECT id FROM timesheets.invoice EXCEPT SELECT id FROM invoices.invoice)
      OR EXISTS (SELECT id FROM timesheets.invoice_line EXCEPT SELECT id FROM invoices.invoice_line)
      OR EXISTS (SELECT id FROM timesheets.invoice_payment EXCEPT SELECT id FROM invoices.invoice_payment)
      OR EXISTS (SELECT id FROM timesheets.invoice_history EXCEPT SELECT id FROM invoices.invoice_history)
      OR EXISTS (SELECT id FROM timesheets.invoice_attachment EXCEPT SELECT id FROM invoices.invoice_attachment)
      OR EXISTS (SELECT id FROM timesheets.invoice_email_delivery EXCEPT SELECT id FROM invoices.invoice_email_delivery)
      OR EXISTS (SELECT id FROM timesheets.invoice_time_entry EXCEPT SELECT id FROM invoices._legacy_timesheet_source)
      OR EXISTS (SELECT organization_id FROM timesheets.workspace_settings EXCEPT SELECT organization_id FROM invoices.settings)
      OR EXISTS (SELECT id FROM timesheets.organization_contact EXCEPT SELECT id FROM invoices.billing_contact)
      OR EXISTS (SELECT id FROM timesheets.workspace_client WHERE invoice_access_enabled EXCEPT SELECT id FROM invoices.client_access)
      OR EXISTS (SELECT id FROM timesheets.workspace_client_invoice_viewer EXCEPT SELECT id FROM invoices.client_viewer)
    THEN
      RAISE EXCEPTION 'Invoice migration verification failed; legacy tables were preserved';
    END IF;

    DROP TABLE timesheets.invoice_time_entry;
    DROP TABLE timesheets.invoice_email_delivery;
    DROP TABLE timesheets.invoice_attachment;
    DROP TABLE timesheets.invoice_history;
    DROP TABLE timesheets.invoice_payment;
    DROP TABLE timesheets.invoice_line;
    DROP TABLE timesheets.invoice;
    DROP TABLE IF EXISTS timesheets.workspace_client_invoice_viewer;
    DROP TABLE IF EXISTS timesheets.organization_contact;
    DROP TABLE IF EXISTS timesheets.organization_invoice_profile;
    ALTER TABLE timesheets.workspace_client DROP COLUMN IF EXISTS invoice_access_enabled;
    ALTER TABLE timesheets.workspace_settings DROP COLUMN IF EXISTS invoicing_enabled;
    ALTER TABLE timesheets.workspace_settings DROP COLUMN IF EXISTS default_vat_rate_basis_points;
    DROP TYPE IF EXISTS timesheets.invoice_email_purpose;
    DROP TYPE IF EXISTS timesheets.invoice_email_delivery_status;
    DROP TYPE IF EXISTS timesheets.invoice_status;
  END IF;
END $$;
