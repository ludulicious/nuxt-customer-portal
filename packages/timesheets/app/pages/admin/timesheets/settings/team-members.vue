<script setup lang="ts">
import type { TimesheetsAdminBootstrap } from '@nuxt-customer-portal/timesheets/app/composables/useTimesheets'

defineProps<{ data: TimesheetsAdminBootstrap; refresh: () => Promise<unknown> }>()
</script>

<template>
  <TimesheetsAdminRates :data="data" :refresh="refresh" />
</template>
