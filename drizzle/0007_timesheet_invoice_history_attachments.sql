CREATE TABLE "timesheets"."invoice_history" (
  "id" text PRIMARY KEY,
  "invoice_id" text NOT NULL REFERENCES "timesheets"."invoice"("id") ON DELETE cascade,
  "action" text NOT NULL,
  "actor_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE restrict,
  "amount_minor" integer,
  "attachment_name" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "invoice_history_invoice_idx" ON "timesheets"."invoice_history" ("invoice_id");
CREATE TABLE "timesheets"."invoice_attachment" (
  "id" text PRIMARY KEY,
  "invoice_id" text NOT NULL REFERENCES "timesheets"."invoice"("id") ON DELETE cascade,
  "file_name" text NOT NULL,
  "content_type" text NOT NULL,
  "size" integer NOT NULL,
  "content_base64" text NOT NULL,
  "uploaded_by_id" text NOT NULL REFERENCES "user"("id") ON DELETE restrict,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "invoice_attachment_invoice_idx" ON "timesheets"."invoice_attachment" ("invoice_id");
