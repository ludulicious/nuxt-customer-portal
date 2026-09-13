import { defineEventHandler, getRouterParam, getQuery } from 'h3'
import { customerAppointment } from '../../../../utils/access'
import { available } from '../../../../utils/booking'
import { canChange } from '../../../../../shared/availability'

export default defineEventHandler(async (event) => {
  const { appointment: a } = await customerAppointment(event, getRouterParam(event, 'id')!)
  if (a.status !== 'confirmed' || !canChange(a.start_at, new Date(), a.snapshot.policy.rescheduleCutoffMinutes)) {
    return []
  }
  return available(a.product_id, getQuery(event), { policy: a.snapshot.policy, duration: a.snapshot.durationMinutes })
})
