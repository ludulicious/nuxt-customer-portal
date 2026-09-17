CREATE SCHEMA IF NOT EXISTS planning;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE planning.settings (
 store_id text PRIMARY KEY REFERENCES public.organization(id), policy jsonb NOT NULL
);
CREATE TABLE planning.provider (
 store_id text NOT NULL REFERENCES public.organization(id), user_id text NOT NULL REFERENCES public."user"(id),
 enabled boolean NOT NULL DEFAULT false, timezone text NOT NULL DEFAULT 'Europe/Amsterdam', grace_minutes integer NOT NULL DEFAULT 0 CHECK(grace_minutes BETWEEN 0 AND 1440),
 busy_calendar_ids text[] NOT NULL DEFAULT '{}', write_calendar_id text, PRIMARY KEY(store_id,user_id)
);
CREATE TABLE planning.connection (
 store_id text NOT NULL, user_id text NOT NULL, provider text NOT NULL CHECK(provider IN ('google','zoom')),
 credentials text NOT NULL, external_user_id text NOT NULL, healthy boolean NOT NULL DEFAULT true, error text,
 PRIMARY KEY(store_id,user_id,provider), FOREIGN KEY(store_id,user_id) REFERENCES planning.provider(store_id,user_id)
);
CREATE TABLE planning.oauth_state (
 id text PRIMARY KEY, store_id text NOT NULL, user_id text NOT NULL, provider text NOT NULL,
 expires_at timestamptz NOT NULL, FOREIGN KEY(store_id,user_id) REFERENCES planning.provider(store_id,user_id)
);
CREATE TABLE planning.availability (
 id uuid PRIMARY KEY, store_id text NOT NULL, user_id text NOT NULL, data jsonb NOT NULL, revision integer NOT NULL DEFAULT 1,
 deleted boolean NOT NULL DEFAULT false, calendar_event_id text, calendar_id text,
 FOREIGN KEY(store_id,user_id) REFERENCES planning.provider(store_id,user_id)
);
CREATE TABLE planning.reservation (
 id uuid PRIMARY KEY, store_id text NOT NULL, user_id text NOT NULL, product_id text NOT NULL REFERENCES products.product(id),
 token_hash text NOT NULL UNIQUE, start_at timestamptz NOT NULL, end_at timestamptz NOT NULL, blocked_until timestamptz NOT NULL,
 expires_at timestamptz NOT NULL, confirmed_at timestamptz, status text NOT NULL CHECK(status IN ('reserved','confirmed','expired','cancelled','superseded')),
 order_id text UNIQUE REFERENCES products.orders(id), replaces_id uuid, snapshot jsonb NOT NULL,
 FOREIGN KEY(store_id,user_id) REFERENCES planning.provider(store_id,user_id),
 CHECK(start_at < end_at AND end_at <= blocked_until),
 EXCLUDE USING gist (user_id WITH =, tstzrange(start_at, blocked_until, '[)') WITH &&) WHERE (status IN ('reserved','confirmed'))
);
CREATE INDEX reservation_expiry ON planning.reservation(expires_at) WHERE status='reserved';
CREATE TABLE planning.appointment (
 id uuid PRIMARY KEY, store_id text NOT NULL, reservation_id uuid NOT NULL UNIQUE REFERENCES planning.reservation(id),
 order_line_id text NOT NULL UNIQUE REFERENCES products.order_line(id), order_id text NOT NULL REFERENCES products.orders(id),
 user_id text NOT NULL REFERENCES public."user"(id), product_id text NOT NULL REFERENCES products.product(id),
 start_at timestamptz NOT NULL, end_at timestamptz NOT NULL, status text NOT NULL CHECK(status IN ('confirmed','cancelled')),
 changes integer NOT NULL DEFAULT 0, revision integer NOT NULL DEFAULT 1, snapshot jsonb NOT NULL,
 meeting_id text, meeting_url text, calendar_event_id text, calendar_id text, calendar_user_id text,
 conflict boolean NOT NULL DEFAULT false, effects_error text
);
ALTER TABLE planning.reservation ADD FOREIGN KEY(replaces_id) REFERENCES planning.appointment(id);
CREATE TABLE planning.audit (
 id uuid PRIMARY KEY, appointment_id uuid NOT NULL REFERENCES planning.appointment(id), actor_id text REFERENCES public."user"(id),
 action text NOT NULL, data jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE planning.job (
 id text PRIMARY KEY, kind text NOT NULL, payload jsonb NOT NULL, attempts integer NOT NULL DEFAULT 0,
 available_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, error text
);
CREATE INDEX job_pending ON planning.job(available_at) WHERE completed_at IS NULL;
CREATE TABLE planning.watch (
 id uuid PRIMARY KEY, store_id text NOT NULL, user_id text NOT NULL, calendar_id text NOT NULL,
 token_hash text NOT NULL, resource_id text, expires_at timestamptz NOT NULL,
 FOREIGN KEY(store_id,user_id) REFERENCES planning.provider(store_id,user_id)
);
