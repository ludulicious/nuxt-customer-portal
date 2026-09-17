ALTER TABLE products.store
  ADD COLUMN storage_provider text NOT NULL DEFAULT 's3';

ALTER TABLE products.store
  ADD CONSTRAINT store_storage_provider_valid CHECK(storage_provider IN ('s3','bunny'));
