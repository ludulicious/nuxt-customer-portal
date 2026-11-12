CREATE TABLE invoices.recurring_invoice (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES public.organization(id) ON DELETE CASCADE,
  created_by_id text NOT NULL REFERENCES public."user"(id) ON DELETE RESTRICT,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  template jsonb NOT NULL,
  next_date date,
  last_generated_date date,
  last_attempt_at timestamp,
  last_error text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX recurring_invoice_org_idx ON invoices.recurring_invoice(organization_id);
CREATE INDEX recurring_invoice_due_idx ON invoices.recurring_invoice(enabled, next_date);
ALTER TABLE invoices.invoice ADD COLUMN recurring_invoice_id text REFERENCES invoices.recurring_invoice(id) ON DELETE RESTRICT;
ALTER TABLE invoices.invoice ADD COLUMN scheduled_date date;
CREATE UNIQUE INDEX invoice_recurring_date_uidx ON invoices.invoice(recurring_invoice_id, scheduled_date);
