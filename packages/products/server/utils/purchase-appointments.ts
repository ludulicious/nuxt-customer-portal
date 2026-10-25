import type { Order } from '../../shared/types'
import { hasPurchaseAccess } from '../../shared/access'
import { planningOrderIntegration } from './contracts'

export async function purchaseAppointments(order: Order) {
  if (!hasPurchaseAccess(order)) {
    return []
  }
  const appointments = (await planningOrderIntegration()?.purchaseAppointments?.(order)) || []
  return appointments.filter((appointment) =>
    order.lines.some((line) => line.id === appointment.orderLineId && hasPurchaseAccess(order, line))
  )
}
