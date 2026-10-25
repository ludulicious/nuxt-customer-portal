export interface PurchaseAppointment {
  id: string
  orderLineId: string
  title: string
  start: string
  end: string
  timezone: string
  status: 'confirmed' | 'cancelled'
}
