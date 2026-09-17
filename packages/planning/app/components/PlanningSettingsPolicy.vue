<script setup lang="ts">
import { defaultPlanningPolicy, planningPolicySchema } from '@nuxt-customer-portal/products/shared/planning'

const api = usePlanning(),
  { t } = useI18n(),
  state = ref(defaultPlanningPolicy()),
  currencies = ref(['EUR']),
  error = ref(''),
  busy = ref(false),
  ready = ref(false)
try {
  const [policy, settings] = await Promise.all([api.policy(), useProducts().settings()])
  state.value = policy
  currencies.value = settings.currencies
  ready.value = true
} catch {
  error.value = t('planning.loadError')
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
</script>

<template>
  <div class="space-y-4">
    <UAlert v-if="error" variant="outline" color="error" :title="error" /><UCard v-if="ready"
      ><template #header
        ><h2 class="font-semibold">{{ t('planning.organizationPolicy') }}</h2></template
      ><UForm :state="state" :schema="planningPolicySchema" novalidate class="space-y-4" @submit="save"
        ><PlanningPolicyFields v-model="state" :currencies="currencies" />
        <div class="flex justify-end">
          <UButton type="submit" icon="i-lucide-save" class="ml-auto flex min-w-28 justify-center" :loading="busy">{{
            t('planning.save')
          }}</UButton>
        </div></UForm
      ></UCard
    >
  </div>
</template>
