INSERT INTO "timesheets"."invoice_history" ("id", "invoice_id", "action", "actor_user_id", "created_at")
SELECT 'invoice-created-' || "id", "id", 'CREATED', "created_by_id", "created_at"
FROM "timesheets"."invoice";

INSERT INTO "timesheets"."invoice_history" ("id", "invoice_id", "action", "actor_user_id", "created_at")
SELECT 'invoice-issued-' || "id", "id", 'ISSUED', "created_by_id", "issued_at"
FROM "timesheets"."invoice"
WHERE "issued_at" IS NOT NULL;

INSERT INTO "timesheets"."invoice_history" ("id", "invoice_id", "action", "actor_user_id", "created_at")
SELECT 'invoice-voided-' || "id", "id", 'VOIDED', "created_by_id", "updated_at"
FROM "timesheets"."invoice"
WHERE "status" = 'VOID';

INSERT INTO "timesheets"."invoice_history" ("id", "invoice_id", "action", "actor_user_id", "amount_minor", "created_at")
SELECT 'invoice-payment-' || "id", "invoice_id", 'PAYMENT_REGISTERED', "created_by_id", "amount_minor", "created_at"
FROM "timesheets"."invoice_payment";
