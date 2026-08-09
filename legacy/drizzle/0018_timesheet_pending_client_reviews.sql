INSERT INTO "timesheets"."client_review" (
  "id", "weekly_timesheet_id", "client_organization_id", "status"
)
SELECT
  'pending-' || md5(wt."id" || ':' || te."client_organization_id"),
  wt."id",
  te."client_organization_id",
  'PENDING'::"timesheets"."client_review_status"
FROM "timesheets"."weekly_timesheet" wt
JOIN "timesheets"."time_entry" te ON te."weekly_timesheet_id" = wt."id"
JOIN "timesheets"."workspace_client" wc
  ON wc."workspace_organization_id" = wt."organization_id"
 AND wc."client_organization_id" = te."client_organization_id"
 AND wc."access_mode" = 'REVIEW'
WHERE wt."status" = 'APPROVED'
GROUP BY wt."id", te."client_organization_id"
ON CONFLICT ("weekly_timesheet_id", "client_organization_id") DO NOTHING;
