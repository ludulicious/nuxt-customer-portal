ALTER TABLE products.store
  ALTER COLUMN image_policy SET DEFAULT '{"thumbnail":{"width":400,"height":400},"gallery":{"width":800,"height":1000},"detail":{"width":1200,"height":900}}'::jsonb;
