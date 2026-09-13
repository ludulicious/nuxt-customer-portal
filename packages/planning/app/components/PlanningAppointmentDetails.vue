<script setup lang="ts">
import type { AppointmentDetails, HoldResult } from '../composables/usePlanning'
import type { Slot } from '../../shared/types'
import { formatMoney } from '@nuxt-customer-portal/products/shared/money'

const props = defineProps<{ id: string }>()
const emit = defineEmits<{ changed: [] }>()
const api = usePlanning(),
  { t, locale } = useI18n(),
  item = ref<AppointmentDetails>(),
  error = ref(''),
  busy = ref(false),
  changeOpen = ref(false),
  cancelOpen = ref(false)
async function load() {
  try {
    item.value = await api.appointment(props.id)
  } catch {
    error.value = t('planning.loadError')
  }
}
onMounted(load)
async function reserved(hold: HoldResult) {
  await navigateTo({
    path: `/store/${encodeURIComponent(item.value!.productSlug)}`,
    query: { appointmentId: item.value!.id, holdToken: hold.holdToken, currency: hold.currency, locale: locale.value }
  })
}
async function abandonChange() {
  busy.value = true
  try {
    await api.abandonChange(item.value!.id)
    await load()
    emit('changed')
  } catch {
    error.value = t('planning.actionError')
  } finally {
    busy.value = false
  }
}
async function selected(slot: Slot, timezone: string) {
  if (busy.value) {
    return
  }
  busy.value = true
  try {
    await api.staffReschedule(item.value!.id, {
      providerUserId: slot.providerUserId,
      start: slot.start,
      customerTimezone: timezone,
      revision: item.value!.revision
    })
    changeOpen.value = false
    await load()
    emit('changed')
  } catch {
    error.value = t('planning.actionError')
  } finally {
    busy.value = false
  }
}
async function cancel() {
  busy.value = true
  try {
    await api.cancel(item.value!.id)
    cancelOpen.value = false
    await load()
    emit('changed')
  } catch {
    error.value = t('planning.actionError')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <div class="space-y-5">
      <UAlert v-if="error" variant="outline" color="error" :title="error" /><template v-if="item"
        ><h1 class="text-2xl font-bold">{{ item.title }}</h1>
        <p>
          {{
            new Intl.DateTimeFormat(locale, {
              dateStyle: 'full',
              timeStyle: 'short',
              timeZone: item.customerTimezone
            }).format(new Date(item.start))
          }}
        </p>
        <p>{{ item.providerName }} · {{ t(`planning.${item.status}`) }}</p>
        <UButton v-if="item.status === 'confirmed' && item.meetingUrl" :to="item.meetingUrl" target="_blank">{{
          t('planning.joinMeeting')
        }}</UButton>
        <UAlert v-if="item.pendingChangeExpiresAt" variant="outline" :title="t('planning.pendingChange')" />
        <UButton
          v-if="item.pendingChangeExpiresAt && item.canManage"
          variant="outline"
          :loading="busy"
          @click="abandonChange"
          >{{ t('planning.abandonChange') }}</UButton
        >
        <div class="flex gap-3">
          <UButton v-if="item.canReschedule" @click="changeOpen = true">{{ t('planning.reschedule') }}</UButton
          ><UButton v-if="item.canCancel" color="error" variant="outline" @click="cancelOpen = true">{{
            t('planning.cancel')
          }}</UButton>
        </div>
        <p v-if="!item.staff">
          {{ t('planning.changesUsed', { used: item.changes, free: item.freeChanges }) }}
        </p></template
      >
      <UModal v-if="changeOpen" v-model:open="changeOpen" :title="t('planning.reschedule')"
        ><template #body
          ><p v-if="item" class="mb-4">
            {{
              item.staff
                ? t('planning.staffChangeNotice')
                : item.changeFee
                  ? t('planning.changeCosts', { amount: formatMoney(item.changeFee, item.currency, locale) })
                  : t('planning.freeChange')
            }}
          </p>
          <PlanningSlotPicker
            v-if="item"
            :product-id="item.productId"
            :currency="item.currency"
            :locale="locale === 'nl' ? 'nl' : 'en'"
            :replaces-id="item.id"
            :select-only="item.staff"
            @selected="selected"
            @reserved="reserved" /></template
      ></UModal>
      <UModal v-if="cancelOpen" v-model:open="cancelOpen" :title="t('planning.cancel')"
        ><template #body
          ><p v-if="item">
            {{ t('planning.cancelConfirm', { amount: formatMoney(item.refundAmount, item.currency, locale) }) }}
          </p>
          <UButton class="mt-4" color="error" :loading="busy" @click="cancel">{{
            t('planning.confirmCancellation')
          }}</UButton></template
        ></UModal
      >
    </div>
  </div>
</template>
