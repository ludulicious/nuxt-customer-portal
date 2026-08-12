CREATE SCHEMA "invoice_timesheets";
--> statement-breakpoint
CREATE TABLE "invoice_timesheets"."invoice_time_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"invoice_line_id" text NOT NULL,
	"time_entry_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoice_timesheets"."invoice_time_entry" ADD CONSTRAINT "invoice_time_entry_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "invoices"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_timesheets"."invoice_time_entry" ADD CONSTRAINT "invoice_time_entry_invoice_line_id_invoice_line_id_fk" FOREIGN KEY ("invoice_line_id") REFERENCES "invoices"."invoice_line"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_timesheets"."invoice_time_entry" ADD CONSTRAINT "invoice_time_entry_time_entry_id_time_entry_id_fk" FOREIGN KEY ("time_entry_id") REFERENCES "timesheets"."time_entry"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_time_entry_invoice_idx" ON "invoice_timesheets"."invoice_time_entry" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_time_entry_entry_idx" ON "invoice_timesheets"."invoice_time_entry" USING btree ("time_entry_id");--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('invoices._legacy_timesheet_source') IS NOT NULL THEN
    INSERT INTO invoice_timesheets.invoice_time_entry SELECT * FROM invoices._legacy_timesheet_source ON CONFLICT (id) DO NOTHING;
    IF EXISTS (SELECT id FROM invoices._legacy_timesheet_source EXCEPT SELECT id FROM invoice_timesheets.invoice_time_entry) THEN
      RAISE EXCEPTION 'Invoice Timesheets source migration verification failed';
    END IF;
    DROP TABLE invoices._legacy_timesheet_source;
  END IF;
END $$;
