ALTER TABLE products.store ADD COLUMN mode text NOT NULL DEFAULT 'live';
ALTER TABLE products.store ALTER COLUMN mode SET DEFAULT 'sandbox';
ALTER TABLE products.store ADD CONSTRAINT store_mode_valid CHECK(mode IN ('sandbox','live'));
