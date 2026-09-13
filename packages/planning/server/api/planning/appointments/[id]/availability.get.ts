import { defineEventHandler, getRouterParam, getQuery } from 'h3'
import { appointmentAccess } from '../../../../utils/access'
import { available } from '../../../../utils/booking'
import { canChange } from '../../../../../shared/availability'

export default defineEventHandler(async (event) => {
  const { appointment: a, staff, canManage } = await appointmentAccess(event, getRouterParam(event, 'id')!)
  if (
    !canManage ||
    a.status !== 'confirmed' ||
    (!staff && !canChange(a.start_at, new Date(), a.snapshot.policy.rescheduleCutoffMinutes))
  ) {
    return []
  }
  return available(a.product_id, getQuery(event), {
    policy: staff ? { ...a.snapshot.policy, minimumNoticeMinutes: 0 } : a.snapshot.policy,
    duration: a.snapshot.durationMinutes
  })
})
