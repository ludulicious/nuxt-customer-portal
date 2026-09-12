CREATE SCHEMA IF NOT EXISTS invoice_products;
CREATE TABLE invoice_products.order_invoice (order_id text PRIMARY KEY REFERENCES products.orders(id) ON DELETE RESTRICT, invoice_id text NOT NULL UNIQUE REFERENCES invoices.invoice(id) ON DELETE RESTRICT);
CREATE TABLE invoice_products.refund_credit (order_id text NOT NULL REFERENCES products.orders(id) ON DELETE RESTRICT, cumulative_amount integer NOT NULL, invoice_id text NOT NULL UNIQUE REFERENCES invoices.invoice(id) ON DELETE RESTRICT, PRIMARY KEY(order_id,cumulative_amount));
