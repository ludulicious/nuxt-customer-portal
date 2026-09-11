ALTER TABLE products.store
  ADD COLUMN storage_endpoint text,
  ADD COLUMN storage_region text,
  ADD COLUMN storage_bucket text,
  ADD COLUMN storage_access_key_id text,
  ADD COLUMN storage_secret_access_key text,
  ADD COLUMN storage_path_style boolean NOT NULL DEFAULT false,
  ADD COLUMN storage_tested_at timestamptz,
  ADD COLUMN image_policy jsonb NOT NULL DEFAULT '{"minimumWidth":1600,"minimumHeight":1200}'::jsonb;

ALTER TABLE products.asset
  ADD COLUMN status text NOT NULL DEFAULT 'uploading',
  ADD COLUMN width integer,
  ADD COLUMN height integer,
  ADD COLUMN failure_reason text,
  ADD COLUMN source_object_key text,
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();

UPDATE products.asset SET status=CASE WHEN ready THEN 'ready' ELSE 'uploading' END;
ALTER TABLE products.asset ADD CONSTRAINT asset_status_valid CHECK(status IN ('uploading','processing','ready','failed'));
