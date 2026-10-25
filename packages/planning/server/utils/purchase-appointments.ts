import type { Order } from '@nuxt-customer-portal/products/shared/types'
import type { PurchaseAppointment } from '@nuxt-customer-portal/products/shared/purchase-appointment'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'

export async function orderAppointments(order: Order): Promise<PurchaseAppointment[]> {
  const appointments = await rows<{
    id: string
    order_line_id: string
    start_at: Date
    end_at: Date
    status: PurchaseAppointment['status']
    snapshot: { title: string; customerTimezone: string; timezone: string }
  }>(
    'SELECT id,order_line_id,start_at,end_at,status,snapshot FROM planning.appointment WHERE store_id=$1 AND order_id=$2 ORDER BY start_at,id',
    [order.store_id, order.id]
  )
  return appointments.map((appointment) => ({
    id: appointment.id,
    orderLineId: appointment.order_line_id,
    title: appointment.snapshot.title,
    start: appointment.start_at.toISOString(),
    end: appointment.end_at.toISOString(),
    timezone: appointment.snapshot.customerTimezone || appointment.snapshot.timezone,
    status: appointment.status
  }))
}
