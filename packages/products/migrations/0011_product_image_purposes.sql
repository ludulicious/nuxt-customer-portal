ALTER TABLE products.asset
  ADD COLUMN image_purpose text
  CHECK (image_purpose IS NULL OR image_purpose IN ('thumbnail', 'gallery', 'detail'));

UPDATE products.store
SET image_policy = jsonb_build_object(
  'thumbnail', jsonb_build_object('width', 400, 'height', 400),
  'gallery', jsonb_build_object('width', 800, 'height', 1000),
  'detail', jsonb_build_object('width', 1200, 'height', 900)
)
WHERE id = true;

ALTER TABLE products.store
  ALTER COLUMN image_policy SET DEFAULT '{"thumbnail":{"width":400,"height":400},"gallery":{"width":800,"height":1000},"detail":{"width":1200,"height":900}}'::jsonb;
