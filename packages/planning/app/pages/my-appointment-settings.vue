<script setup lang="ts">
definePageMeta({ path: '/planning/settings' })
const { t } = useI18n(),
  route = useRoute()
const items = computed(() => [
  { label: t('planning.calendarSettings'), value: 'calendar', slot: 'calendar' },
  { label: t('planning.meetingSettings'), value: 'meeting', slot: 'meeting' }
])
const tab = computed({
  get: () => (route.query.tab === 'meeting' ? 'meeting' : 'calendar'),
  set: (value: string) => {
    void navigateTo({ query: { ...route.query, tab: value === 'meeting' ? 'meeting' : undefined } }, { replace: true })
  }
})
</script>

<template>
  <div class="h-full min-h-0 overflow-y-auto">
    <UContainer class="space-y-6 py-8">
      <h1 class="text-2xl font-bold">{{ t('planning.myAppointmentSettings') }}</h1>
      <UTabs
        v-model="tab"
        :items="items"
        variant="link"
        :unmount-on-hide="true"
        :ui="{ list: 'justify-start', trigger: 'grow-0' }"
        class="w-full"
      >
        <template #calendar><PlanningPersonalCalendarSettings class="pt-4" /></template>
        <template #meeting><PlanningPersonalMeetingSettings class="pt-4" /></template> </UTabs
    ></UContainer>
  </div>
</template>
