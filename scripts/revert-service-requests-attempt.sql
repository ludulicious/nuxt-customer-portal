-- Revert the migrations introduced by the service-requests-attempt branch:
--   service-requests/0002_production_workflow.sql
--   invoice-service-requests/0000_baseline.sql
--
-- This script intentionally keeps 0001_required_client.sql in place because it
-- is also present on master. It does not delete invoices created through the
-- bridge. Run this only after taking a database backup and stopping application
-- instances that can write to the database.
--
-- Attempt-only data is copied to service_request_attempt_rollback before the
-- production-workflow tables and columns are removed. The fixed backup-schema
-- name also makes an accidental second execution fail instead of overwriting
-- the first rollback snapshot.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('nuxt-customer-portal:migrations'));

DO $rollback_preconditions$
BEGIN
  IF to_regclass('service_requests.service_request') IS NULL THEN
    RAISE EXCEPTION 'service_requests.service_request does not exist';
  END IF;

  IF to_regclass('service_requests.service_request_activity') IS NULL
     OR to_regclass('service_requests.service_request_attachment') IS NULL
     OR to_regclass('service_requests.service_request_quote') IS NULL
     OR to_regclass('service_requests.service_request_quote_line') IS NULL THEN
    RAISE EXCEPTION 'The service-request production workflow migration is not fully installed';
  END IF;

  IF to_regclass('invoice_service_requests.invoice_service_request') IS NULL THEN
    RAISE EXCEPTION 'The invoice/service-request bridge migration is not installed';
  END IF;

  IF to_regnamespace('service_request_attempt_rollback') IS NOT NULL THEN
    RAISE EXCEPTION 'Backup schema service_request_attempt_rollback already exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM nuxt_customer_portal_migrations.provider_service_requests
    WHERE name = '0002_production_workflow.sql'
  ) THEN
    RAISE EXCEPTION 'Migration journal entry service-requests/0002_production_workflow.sql is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM nuxt_customer_portal_migrations.provider_invoice_service_requests
    WHERE name = '0000_baseline.sql'
  ) THEN
    RAISE EXCEPTION 'Migration journal entry invoice-service-requests/0000_baseline.sql is missing';
  END IF;
END
$rollback_preconditions$;

CREATE SCHEMA service_request_attempt_rollback;

CREATE TABLE service_request_attempt_rollback.service_request_workflow AS
SELECT
  id,
  status::text AS workflow_status,
  contact_name,
  contact_email,
  contact_phone,
  requested_date,
  service_location,
  evaluating_at,
  accepted_at,
  started_at,
  completed_at,
  declined_at,
  cancelled_at
FROM service_requests.service_request;

CREATE TABLE service_request_attempt_rollback.service_request_activity AS
TABLE service_requests.service_request_activity;

CREATE TABLE service_request_attempt_rollback.service_request_attachment AS
TABLE service_requests.service_request_attachment;

CREATE TABLE service_request_attempt_rollback.service_request_quote AS
TABLE service_requests.service_request_quote;

CREATE TABLE service_request_attempt_rollback.service_request_quote_line AS
TABLE service_requests.service_request_quote_line;

CREATE TABLE service_request_attempt_rollback.invoice_service_request AS
TABLE invoice_service_requests.invoice_service_request;

COMMENT ON SCHEMA service_request_attempt_rollback IS
  'Data preserved while reverting the service-requests-attempt branch migrations';

-- Preserve the closest legacy lifecycle timestamps before removing the new
-- workflow timestamp columns.
UPDATE service_requests.service_request
SET resolved_at = COALESCE(resolved_at, completed_at, updated_at)
WHERE status::text = 'COMPLETED';

UPDATE service_requests.service_request
SET closed_at = COALESCE(closed_at, declined_at, cancelled_at, updated_at)
WHERE status::text IN ('DECLINED', 'CANCELLED');

-- Remove the bridge first because it references both requests and quotes.
DROP TABLE invoice_service_requests.invoice_service_request;
DROP SCHEMA invoice_service_requests;

DROP TABLE service_requests.service_request_quote_line;
DROP TABLE service_requests.service_request_quote;
DROP TABLE service_requests.service_request_attachment;
DROP TABLE service_requests.service_request_activity;
DROP TYPE service_requests.service_request_quote_status;
DROP TYPE service_requests.service_request_activity_type;

DROP INDEX service_requests.service_request_requested_date_idx;

ALTER TABLE service_requests.service_request
  DROP COLUMN contact_name,
  DROP COLUMN contact_email,
  DROP COLUMN contact_phone,
  DROP COLUMN requested_date,
  DROP COLUMN service_location,
  DROP COLUMN evaluating_at,
  DROP COLUMN accepted_at,
  DROP COLUMN started_at,
  DROP COLUMN completed_at,
  DROP COLUMN declined_at,
  DROP COLUMN cancelled_at;

-- PostgreSQL enum values cannot be removed in place. Rebuild the enum with the
-- legacy values while mapping every new workflow state deterministically.
ALTER TABLE service_requests.service_request ALTER COLUMN status DROP DEFAULT;
DROP INDEX service_requests.service_request_status_idx;
ALTER TYPE service_requests."ServiceRequestStatus" RENAME TO "ServiceRequestStatus_attempt";
CREATE TYPE service_requests."ServiceRequestStatus" AS ENUM (
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED'
);

ALTER TABLE service_requests.service_request
  ALTER COLUMN status TYPE service_requests."ServiceRequestStatus"
  USING (
    CASE status::text
      WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS'
      WHEN 'COMPLETED' THEN 'RESOLVED'
      WHEN 'DECLINED' THEN 'CLOSED'
      WHEN 'CANCELLED' THEN 'CLOSED'
      ELSE 'OPEN'
    END
  )::service_requests."ServiceRequestStatus";

ALTER TABLE service_requests.service_request ALTER COLUMN status SET DEFAULT 'OPEN';
CREATE INDEX service_request_status_idx ON service_requests.service_request (status);
DROP TYPE service_requests."ServiceRequestStatus_attempt";

-- Remove only the two entries that this script genuinely reverted. The normal
-- migration runner can then apply redesigned migrations in the future.
DELETE FROM nuxt_customer_portal_migrations.provider_service_requests
WHERE name = '0002_production_workflow.sql';

DELETE FROM nuxt_customer_portal_migrations.provider_invoice_service_requests
WHERE name = '0000_baseline.sql';

COMMIT;

-- Useful post-run checks (read-only):
-- SELECT status, count(*) FROM service_requests.service_request GROUP BY status ORDER BY status;
-- SELECT * FROM nuxt_customer_portal_migrations.provider_service_requests ORDER BY name;
-- SELECT * FROM service_request_attempt_rollback.service_request_workflow ORDER BY id;
