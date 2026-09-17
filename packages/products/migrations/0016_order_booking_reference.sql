ALTER TABLE products.orders
  ADD COLUMN booking_reference text;

UPDATE products.orders
SET booking_reference = 'BK-' || upper(substr(replace(id, '-', ''), 1, 12));

ALTER TABLE products.orders
  ALTER COLUMN booking_reference SET DEFAULT ('BK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  ALTER COLUMN booking_reference SET NOT NULL;

CREATE UNIQUE INDEX orders_booking_reference ON products.orders(booking_reference);
