import { registerPlanningOrderIntegration } from '@nuxt-customer-portal/products/server/utils/contracts'
import { orderAppointments } from '../utils/purchase-appointments'
import { prepareCheckout, bindPrepared, prepareOrder, confirm } from '../utils/booking'

export default defineNitroPlugin(() =>
  registerPlanningOrderIntegration({
    prepareCheckout,
    bind: bindPrepared,
    prepareOrder,
    confirm,
    purchaseAppointments: orderAppointments
  })
)
