<script setup lang="ts">
import { defaultPlanningPolicy, planningPolicySchema } from '@nuxt-customer-portal/products/shared/planning'
import type { ProviderSettings } from '../../../shared/types'
import type { AppointmentListItem } from '../../composables/usePlanning'

const { t, locale } = useI18n(),
  api = usePlanning(),
  providers = ref<ProviderSettings[]>([]),
  appointments = ref<AppointmentListItem[]>([]),
  jobs = ref<Array<{ id: string; kind: string; attempts: number; error: string | null }>>([]),
  state = ref(defaultPlanningPolicy()),
  currencies = ref(['EUR']),
  error = ref(''),
  busy = ref(false)
async function load() {
  try {
    ;[providers.value, appointments.value, jobs.value, state.value] = await Promise.all([
      api.providers(),
      api.adminAppointments(),
      api.jobs(),
      api.policy()
    ])
    currencies.value = (await useProducts().settings()).currencies
  } catch {
    error.value = t('planning.loadError')
  }
}
onMounted(load)
async function toggle(id: string, enabled: boolean) {
  busy.value = true
  try {
    await api.setEnabled(id, enabled)
    await load()
  } catch {
    error.value = t('planning.actionError')
  } finally {
    busy.value = false
  }
}
async function save() {
  busy.value = true
  try {
    state.value = await api.savePolicy(state.value)
  } catch {
    error.value = t('planning.actionError')
  } finally {
    busy.value = false
  }
}
async function retry() {
  busy.value = true
  try {
    await api.retry()
    await load()
  } catch {
    error.value = t('planning.actionError')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="h-full min-h-0 overflow-y-auto">
    <UContainer class="space-y-6 py-8"
      ><h1 class="text-2xl font-bold">{{ t('planning.settings') }}</h1>
      <UAlert v-if="error" variant="outline" color="error" :title="error" /><UCard
        ><template #header
          ><h2 class="font-semibold">{{ t('planning.providers') }}</h2></template
        >
        <div class="space-y-4">
          <div v-for="provider in providers" :key="provider.userId" class="flex flex-wrap items-center gap-3">
            <span class="grow">{{ provider.name }}</span
            ><UBadge :color="provider.googleConnected ? 'success' : 'warning'">Google</UBadge
            ><UBadge :color="provider.zoomConnected ? 'success' : 'warning'">Zoom</UBadge
            ><USwitch
              :model-value="provider.enabled"
              :disabled="busy"
              :aria-label="t('planning.planning') + ' ' + provider.name"
              @update:model-value="toggle(provider.userId, $event)"
            />
          </div></div
      ></UCard>
      <UCard
        ><template #header
          ><h2 class="font-semibold">{{ t('planning.organizationPolicy') }}</h2></template
        ><UForm :state="state" :schema="planningPolicySchema" novalidate class="space-y-4" @submit="save"
          ><PlanningPolicyFields v-model="state" :currencies="currencies" /><UButton type="submit" :loading="busy">{{
            t('planning.save')
          }}</UButton></UForm
        ></UCard
      >
      <UCard
        ><template #header
          ><h2 class="font-semibold">{{ t('planning.appointments') }}</h2></template
        >
        <div class="space-y-3">
          <div v-for="appointment in appointments" :key="appointment.id" class="border-b border-default pb-3">
            <h3 class="font-semibold">{{ appointment.title }} · {{ appointment.providerName }}</h3>
            <p>
              {{
                new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(
                  new Date(appointment.start)
                )
              }}
              · {{ appointment.email }} · {{ t(`planning.${appointment.status}`) }}
            </p>
            <UBadge v-if="appointment.conflict" color="error">{{ t('planning.conflict') }}</UBadge>
            <p v-if="appointment.effectsError" class="text-error">{{ appointment.effectsError }}</p>
          </div>
        </div></UCard
      >
      <UCard
        ><template #header
          ><h2 class="font-semibold">{{ t('planning.pendingTasks') }}</h2></template
        >
        <p v-if="!jobs.length">{{ t('planning.noPendingTasks') }}</p>
        <div v-for="job in jobs" :key="job.id" class="mb-2">
          <p>{{ job.kind }} · {{ t('planning.attempts', { count: job.attempts }) }}</p>
          <p v-if="job.error" class="text-error">{{ job.error }}</p>
        </div>
        <UButton v-if="jobs.length" :loading="busy" @click="retry">{{ t('planning.retry') }}</UButton></UCard
      >
    </UContainer>
  </div>
</template>
