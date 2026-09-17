import { defineEventHandler } from 'h3'
import { appointmentScope } from '@nuxt-customer-portal/planning/server/utils/access'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import type { PlanningDashboardAppointment, PlanningDashboardDto } from '@nuxt-customer-portal/planning/shared/types'

export default defineEventHandler(async (event): Promise<PlanningDashboardDto> => {
  const scope = await appointmentScope(event)
  const values = [scope.storeId, scope.staff, scope.userId]
  const audience = 'a.store_id=$1 AND ($2::boolean AND a.user_id=$3 OR NOT $2::boolean AND o.buyer_id=$3)'
  const from =
    'FROM planning.appointment a JOIN products.orders o ON o.id=a.order_id JOIN public."user" u ON u.id=a.user_id LEFT JOIN planning.provider p ON p.store_id=a.store_id AND p.user_id=a.user_id'
  const [summary] = await rows<{ upcomingCount: number; todayCount: number; conflictCount: number }>(
    `SELECT
       count(*) FILTER (WHERE a.status='confirmed' AND a.end_at>=now())::int AS "upcomingCount",
       count(*) FILTER (WHERE a.status='confirmed' AND a.start_at>=date_trunc('day',now()) AND a.start_at<date_trunc('day',now())+interval '1 day')::int AS "todayCount",
       count(*) FILTER (WHERE a.status='confirmed' AND a.end_at>=now() AND a.conflict)::int AS "conflictCount"
     ${from} WHERE ${audience}`,
    values
  )
  const appointments = await rows<PlanningDashboardAppointment>(
    `SELECT a.id,a.start_at AS start,a.end_at AS end,a.snapshot->>'title' AS title,
      a.snapshot->>'meetingProvider' AS "meetingProvider",a.meeting_url AS "meetingUrl",a.conflict,
      u.name AS "providerName",COALESCE(a.snapshot->>'timezone',p.timezone,u.timezone,'Europe/Amsterdam') AS "providerTimezone",
      o.snapshot->'billing'->>'name' AS "customerName",a.snapshot->>'customerTimezone' AS "customerTimezone"
     ${from} WHERE ${audience} AND a.status='confirmed' AND a.end_at>=now()
     ORDER BY a.start_at,a.id LIMIT 3`,
    values
  )
  return {
    access: { staff: scope.staff, canManage: scope.canManage },
    upcomingCount: summary?.upcomingCount ?? 0,
    todayCount: summary?.todayCount ?? 0,
    conflictCount: scope.staff ? (summary?.conflictCount ?? 0) : 0,
    appointments
  }
})
