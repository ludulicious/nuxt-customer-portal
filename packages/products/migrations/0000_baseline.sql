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
CREATE TABLE products.orders (
 id text PRIMARY KEY, store_id text NOT NULL REFERENCES public.organization(id) ON DELETE RESTRICT, cart_id text UNIQUE,
 request_id text NOT NULL UNIQUE, request_hash text NOT NULL,
 buyer_id text REFERENCES public."user"(id) ON DELETE RESTRICT, client_id text REFERENCES public.organization(id) ON DELETE RESTRICT,
 email text NOT NULL, snapshot jsonb NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','failed','expired')),
 checkout_id text UNIQUE, payment_id text UNIQUE, total integer, net integer, tax integer, tax_details jsonb,
 refunded integer NOT NULL DEFAULT 0 CHECK(refunded>=0), disputed boolean NOT NULL DEFAULT false,
 invoice_id text, invitation_id text, notified boolean NOT NULL DEFAULT false,
 processing text NOT NULL DEFAULT 'pending', error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_buyer ON products.orders(buyer_id);
CREATE INDEX orders_email ON products.orders(email);
CREATE INDEX orders_store ON products.orders(store_id,created_at);
CREATE TABLE products.order_line (
 id text PRIMARY KEY, order_id text NOT NULL REFERENCES products.orders(id) ON DELETE CASCADE, position integer NOT NULL CHECK(position>=0),
 product_id text NOT NULL REFERENCES products.product(id) ON DELETE RESTRICT, price_id text NOT NULL REFERENCES products.price(id) ON DELETE RESTRICT,
 quantity integer NOT NULL CHECK(quantity>0), snapshot jsonb NOT NULL, unit_amount integer NOT NULL CHECK(unit_amount>=0),
 total integer, net integer, tax integer, tax_details jsonb, refunded integer NOT NULL DEFAULT 0 CHECK(refunded>=0),
 fulfilled boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(order_id,position)
);
CREATE INDEX order_line_product ON products.order_line(product_id);
CREATE TABLE products.cart (
 id text PRIMARY KEY, store_id text NOT NULL REFERENCES public.organization(id) ON DELETE RESTRICT,
 buyer_id text REFERENCES public."user"(id) ON DELETE RESTRICT, token_hash text NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','converted','expired')),
 locale text NOT NULL CHECK(locale IN ('en','nl')), currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cart_store_status ON products.cart(store_id,status);
CREATE INDEX cart_buyer ON products.cart(buyer_id);
ALTER TABLE products.orders ADD CONSTRAINT orders_cart_fk FOREIGN KEY(cart_id) REFERENCES products.cart(id) ON DELETE RESTRICT;
CREATE TABLE products.cart_line (
 id text PRIMARY KEY, cart_id text NOT NULL REFERENCES products.cart(id) ON DELETE CASCADE,
 product_id text NOT NULL REFERENCES products.product(id) ON DELETE RESTRICT, price_id text NOT NULL REFERENCES products.price(id) ON DELETE RESTRICT,
 quantity integer NOT NULL CHECK(quantity>0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(cart_id,product_id,price_id)
);
CREATE TABLE products.webhook (
 id text PRIMARY KEY, type text NOT NULL, order_id text, created_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz, error text
);
CREATE TABLE products.rate_limit (id text PRIMARY KEY, bucket_minute bigint NOT NULL, count integer NOT NULL);
