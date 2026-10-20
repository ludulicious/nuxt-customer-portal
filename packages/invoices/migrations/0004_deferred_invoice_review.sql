ALTER TABLE invoices.invoice ADD COLUMN agreed_total_minor integer;
ALTER TABLE invoices.invoice ADD COLUMN tax_review_required boolean NOT NULL DEFAULT false;
