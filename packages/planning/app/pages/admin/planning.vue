<script setup lang="ts">
const { t } = useI18n(),
  route = useRoute()
const items = computed(() => [
  { label: t('planning.providers'), value: 'members', slot: 'members' },
  { label: t('planning.bookingPolicyTab'), value: 'policy', slot: 'policy' },
  { label: t('planning.synchronizationTab'), value: 'synchronization', slot: 'synchronization' }
])
const tab = computed({
  get: () =>
    ['members', 'policy', 'synchronization'].includes(String(route.query.tab)) ? String(route.query.tab) : 'members',
  set: (value: string) => {
    void navigateTo({ query: { ...route.query, tab: value === 'members' ? undefined : value } }, { replace: true })
  }
})
</script>

<template>
  <div class="h-full min-h-0 overflow-y-auto">
    <UContainer class="space-y-6 py-8"
      ><div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-2xl font-bold">{{ t('planning.settings') }}</h1>
        <UButton to="/appointments" icon="i-lucide-calendar-check" color="neutral" variant="outline">{{
          t('planning.appointments')
        }}</UButton>
      </div>
      <UTabs
        v-model="tab"
        :items="items"
        variant="link"
        :unmount-on-hide="true"
        :ui="{ list: 'justify-start', trigger: 'grow-0' }"
        class="w-full"
        ><template #members><PlanningSettingsMembers class="pt-4" /></template
        ><template #policy><PlanningSettingsPolicy class="pt-4" /></template
        ><template #synchronization><PlanningSettingsSynchronization class="pt-4" /></template></UTabs
    ></UContainer>
  </div>
</template>
