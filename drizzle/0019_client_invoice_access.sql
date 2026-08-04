ALTER TABLE "timesheets"."workspace_client" ADD COLUMN "invoice_access_enabled" boolean DEFAULT false NOT NULL;
CREATE TABLE "timesheets"."workspace_client_invoice_viewer" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_client_id" text NOT NULL REFERENCES "timesheets"."workspace_client"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "public"."user"("id") ON DELETE cascade,
  "created_by_id" text NOT NULL REFERENCES "public"."user"("id") ON DELETE restrict,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "workspace_client_invoice_viewer_link_user_uidx" ON "timesheets"."workspace_client_invoice_viewer" ("workspace_client_id", "user_id");
CREATE INDEX "workspace_client_invoice_viewer_user_idx" ON "timesheets"."workspace_client_invoice_viewer" ("user_id");
