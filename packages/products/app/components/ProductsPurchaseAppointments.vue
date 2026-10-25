<script setup lang="ts">
import type { PurchaseAppointment } from '../../shared/purchase-appointment'
import { formatAppointmentRange } from '@nuxt-customer-portal/core/shared/appointment-time'

defineProps<{ appointments: PurchaseAppointment[]; locale: string }>()
const { t } = useI18n()
</script>

<template>
  <section class="purchase-appointments" :aria-label="t('products.purchaseAppointments')">
    <h2>{{ t('products.purchaseAppointments') }}</h2>
    <div v-for="appointment in appointments" :key="appointment.id" class="purchase-appointment">
      <p class="appointment-title">{{ appointment.title }}</p>
      <p v-if="appointment.status === 'cancelled'" role="status">{{ t('products.appointmentCancelled') }}</p>
      <p :class="{ 'appointment-cancelled': appointment.status === 'cancelled' }">
        <time :datetime="appointment.start">{{
          formatAppointmentRange(appointment.start, appointment.end, {
            locale,
            timeZone: appointment.timezone,
            midnight: t('products.midnight')
          })
        }}</time>
      </p>
      <p class="appointment-timezone">{{ appointment.timezone }}</p>
    </div>
  </section>
</template>

<style scoped>
.purchase-appointments {
  margin-top: 28px;
  padding-top: 24px;
  border-top: 1px solid var(--checkout-border);
  overflow-wrap: anywhere;
  color: var(--checkout-display);
}
h2 {
  margin: 0 0 16px;
  font-family: var(--checkout-body-font);
  font-size: 1rem;
  font-weight: 700;
}
.purchase-appointment + .purchase-appointment {
  margin-top: 16px;
}
p {
  margin: 4px 0;
  line-height: 1.6;
}
.appointment-title {
  font-weight: 600;
}
.appointment-timezone {
  font-size: 0.875rem;
  color: var(--checkout-muted);
}
.appointment-cancelled {
  text-decoration: line-through;
}
</style>
