DO $$
BEGIN
  -- A clean Timesheets-only installation must not retain invoice objects from the
  -- historical combined baseline. Preserve any populated legacy installation so
  -- the Invoices migration can copy and verify it transactionally first.
  IF to_regclass('timesheets.invoice') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM timesheets.invoice)
    AND NOT EXISTS (SELECT 1 FROM timesheets.organization_invoice_profile)
    AND NOT EXISTS (SELECT 1 FROM timesheets.organization_contact)
    AND NOT EXISTS (SELECT 1 FROM timesheets.workspace_client_invoice_viewer)
    AND NOT EXISTS (SELECT 1 FROM timesheets.workspace_client WHERE invoice_access_enabled)
    AND NOT EXISTS (SELECT 1 FROM timesheets.workspace_settings WHERE invoicing_enabled)
  THEN
    DROP TABLE timesheets.invoice_time_entry;
    DROP TABLE timesheets.invoice_email_delivery;
    DROP TABLE timesheets.invoice_attachment;
    DROP TABLE timesheets.invoice_history;
    DROP TABLE timesheets.invoice_payment;
    DROP TABLE timesheets.invoice_line;
    DROP TABLE timesheets.invoice;
    DROP TABLE timesheets.workspace_client_invoice_viewer;
    DROP TABLE timesheets.organization_contact;
    DROP TABLE timesheets.organization_invoice_profile;
    ALTER TABLE timesheets.workspace_client DROP COLUMN invoice_access_enabled;
    ALTER TABLE timesheets.workspace_settings DROP COLUMN invoicing_enabled;
    ALTER TABLE timesheets.workspace_settings DROP COLUMN default_vat_rate_basis_points;
    DROP TYPE timesheets.invoice_email_purpose;
    DROP TYPE timesheets.invoice_email_delivery_status;
    DROP TYPE timesheets.invoice_status;
  END IF;
END $$;
