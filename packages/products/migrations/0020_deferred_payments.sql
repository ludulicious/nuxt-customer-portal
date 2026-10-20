ALTER TABLE products.store ADD COLUMN online_payment boolean NOT NULL DEFAULT true;
ALTER TABLE products.store ADD COLUMN invoice_payment boolean NOT NULL DEFAULT false;
ALTER TABLE products.orders DROP CONSTRAINT orders_status_check;
ALTER TABLE products.orders ADD CONSTRAINT orders_status_check CHECK(status IN ('pending','paid','accepted','failed','expired'));
