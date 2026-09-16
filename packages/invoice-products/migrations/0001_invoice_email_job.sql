CREATE TABLE invoice_products.email_job (
 order_id text PRIMARY KEY REFERENCES products.orders(id) ON DELETE CASCADE,
 actor_id text NOT NULL REFERENCES public."user"(id) ON DELETE RESTRICT,
 available_at timestamptz NOT NULL DEFAULT now() + interval '5 minutes',
 attempts integer NOT NULL DEFAULT 0,
 completed_at timestamptz,
 error text
);
CREATE INDEX invoice_products_email_job_pending ON invoice_products.email_job(available_at) WHERE completed_at IS NULL;
