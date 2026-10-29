CREATE TABLE products.media_upload (
  id text PRIMARY KEY,
  store_id text NOT NULL REFERENCES public.organization(id),
  committed_media_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE products.media_file (
  id text PRIMARY KEY,
  store_id text NOT NULL REFERENCES public.organization(id),
  upload_id text NOT NULL REFERENCES products.media_upload(id) ON DELETE CASCADE,
  role text NOT NULL CHECK(role IN ('original','image','thumbnail')),
  name text NOT NULL,
  content_type text NOT NULL CHECK(content_type IN ('image/jpeg','image/png','image/webp','image/gif')),
  size bigint NOT NULL CHECK(size > 0 AND size <= 10485760),
  object_key text NOT NULL UNIQUE,
  width integer,
  height integer,
  ready boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(upload_id,role),
  UNIQUE(store_id,id)
);
CREATE TABLE products.media (
  id text PRIMARY KEY,
  store_id text NOT NULL REFERENCES public.organization(id),
  title text NOT NULL,
  alt text NOT NULL,
  categories text[] NOT NULL DEFAULT '{}',
  credit text NOT NULL DEFAULT '',
  visible boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  revision integer NOT NULL DEFAULT 1,
  original_file_id text NOT NULL,
  image_file_id text NOT NULL,
  thumbnail_file_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(store_id,original_file_id) REFERENCES products.media_file(store_id,id),
  FOREIGN KEY(store_id,image_file_id) REFERENCES products.media_file(store_id,id),
  FOREIGN KEY(store_id,thumbnail_file_id) REFERENCES products.media_file(store_id,id)
);
CREATE INDEX media_store_order ON products.media(store_id,position,id);
CREATE INDEX media_file_upload ON products.media_file(upload_id);
CREATE INDEX media_upload_created ON products.media_upload(created_at);
