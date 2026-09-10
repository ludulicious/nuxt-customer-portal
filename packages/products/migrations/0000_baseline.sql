CREATE SCHEMA IF NOT EXISTS products;
CREATE TABLE products.store (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), organization_id text NOT NULL REFERENCES public.organization(id) ON DELETE RESTRICT,
 actor_id text NOT NULL REFERENCES public."user"(id) ON DELETE RESTRICT, enabled boolean NOT NULL DEFAULT false, default_locale text NOT NULL DEFAULT 'en' CHECK(default_locale IN ('en','nl'))
);
CREATE TABLE products.product (
 id text PRIMARY KEY, store_id text NOT NULL REFERENCES public.organization(id) ON DELETE RESTRICT, slug text NOT NULL,
 data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(store_id,slug)
);
CREATE TABLE products.price (
 id text PRIMARY KEY, product_id text NOT NULL REFERENCES products.product(id) ON DELETE RESTRICT,
 currency text NOT NULL, amount integer NOT NULL CHECK(amount > 0), tax_behavior text NOT NULL CHECK(tax_behavior IN ('inclusive','exclusive')), active boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX price_active_currency ON products.price(product_id,currency) WHERE active;
CREATE TABLE products.asset (
 id text PRIMARY KEY, product_id text NOT NULL REFERENCES products.product(id) ON DELETE CASCADE,
 name text NOT NULL, content_type text NOT NULL, size bigint NOT NULL, visibility text NOT NULL CHECK(visibility IN ('public','private')),
 object_key text NOT NULL UNIQUE, ready boolean NOT NULL DEFAULT false
);
CREATE TABLE products.api_key (
 id text PRIMARY KEY, store_id text NOT NULL REFERENCES public.organization(id) ON DELETE RESTRICT,
 name text NOT NULL, hash text NOT NULL UNIQUE, prefix text NOT NULL, expires_at timestamptz, revoked_at timestamptz, last_used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE products.purchase (
 id text PRIMARY KEY, store_id text NOT NULL REFERENCES public.organization(id) ON DELETE RESTRICT,
 product_id text NOT NULL REFERENCES products.product(id) ON DELETE RESTRICT, price_id text NOT NULL REFERENCES products.price(id),
 request_id text NOT NULL UNIQUE, request_hash text NOT NULL,
 buyer_id text REFERENCES public."user"(id) ON DELETE RESTRICT, client_id text REFERENCES public.organization(id) ON DELETE RESTRICT,
 email text NOT NULL, snapshot jsonb NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','failed','expired')),
 checkout_id text UNIQUE, payment_id text UNIQUE, total integer, net integer, tax integer, tax_details jsonb,
 refunded integer NOT NULL DEFAULT 0 CHECK(refunded>=0), disputed boolean NOT NULL DEFAULT false, fulfilled boolean NOT NULL DEFAULT false,
 invoice_id text, invitation_id text, notified boolean NOT NULL DEFAULT false,
 processing text NOT NULL DEFAULT 'pending', error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX purchase_buyer ON products.purchase(buyer_id);
CREATE INDEX purchase_email ON products.purchase(email);
CREATE INDEX purchase_store ON products.purchase(store_id,created_at);
CREATE TABLE products.webhook (
 id text PRIMARY KEY, type text NOT NULL, purchase_id text, created_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz, error text
);
CREATE TABLE products.rate_limit (id text PRIMARY KEY, bucket_minute bigint NOT NULL, count integer NOT NULL);
