CREATE TABLE products.thank_you_text (
  store_id text NOT NULL REFERENCES public.organization(id) ON DELETE CASCADE,
  product_slug text NOT NULL DEFAULT '' CHECK (length(product_slug) <= 200),
  locale text NOT NULL CHECK (locale IN ('en', 'nl')),
  variant text NOT NULL CHECK (variant IN ('free', 'paid')),
  copy jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(copy) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, product_slug, locale, variant)
);
