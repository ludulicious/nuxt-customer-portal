ALTER TABLE invoices.settings ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE invoices.invoice ADD COLUMN IF NOT EXISTS sender_country text;
