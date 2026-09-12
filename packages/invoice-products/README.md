# Product invoices

Connects `@nuxt-customer-portal/products` with `@nuxt-customer-portal/invoices`. Paid Stripe orders create one portal invoice and payment using immutable checkout totals. Refunds produce linked credit notes without rewriting the original invoice. Provider references and order/invoice mappings make repeated processing idempotent.

Install Products, Invoices, and this layer, run migrations, and complete the invoice sender and email configuration before opening the store. See the Products package README for deployment, Stripe webhook, storage, tax, and retry-task setup.

The integration uses the public Invoices commerce contract and registers through Products' order integration. Each immutable order line becomes an invoice line. Polar is not implemented: merchant-of-record transactions must not issue a second seller invoice through this Stripe integration.
