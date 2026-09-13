<script setup lang="ts">
const { t, locale } = useI18n(),
  items = ref<import('../../composables/usePlanning').AppointmentListItem[]>([]),
  error = ref('')
onMounted(async () => {
  try {
    items.value = await usePlanning().appointments()
  } catch {
    error.value = t('planning.loadError')
  }
})
</script>

<template>
  <UContainer class="space-y-5 py-8"
    ><h1 class="text-2xl font-bold">{{ t('planning.appointments') }}</h1>
    <UAlert v-if="error" variant="outline" color="error" :title="error" />
    <p v-if="!items.length">{{ t('planning.noAppointments') }}</p>
    <UCard v-for="item in items" :key="item.id"
      ><h2 class="font-semibold">{{ item.title }}</h2>
      <p>
        {{
          new Intl.DateTimeFormat(locale, {
            dateStyle: 'long',
            timeStyle: 'short',
            timeZone: item.customerTimezone || 'Europe/Amsterdam'
          }).format(new Date(item.start))
        }}
        · {{ item.providerName }}
      </p>
      <p>{{ t(`planning.${item.status}`) }}</p>
      <UButton :to="'/appointments/' + item.id" variant="outline">{{ t('planning.manage') }}</UButton></UCard
    ></UContainer
  >
</template>
