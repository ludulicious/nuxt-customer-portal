ALTER TABLE invoices.invoice ADD COLUMN document_type text NOT NULL DEFAULT 'invoice' CHECK(document_type IN ('invoice','credit'));
ALTER TABLE invoices.invoice ADD COLUMN original_invoice_id text REFERENCES invoices.invoice(id);
ALTER TABLE invoices.invoice ADD COLUMN external_reference text;
ALTER TABLE invoices.invoice ADD COLUMN automated boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX invoice_external_reference ON invoices.invoice(organization_id,external_reference) WHERE external_reference IS NOT NULL;
ALTER TABLE invoices.invoice_line ADD COLUMN exact_tax_minor integer;
ALTER TABLE invoices.invoice_line ADD COLUMN tax_details jsonb;
