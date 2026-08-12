<script setup lang="ts">
import type { TimesheetsAdminBootstrap } from '@nuxt-customer-portal/timesheets/app/composables/useTimesheets'
import TimesheetsWorkspaceSettingsForm from './TimesheetsWorkspaceSettingsForm.vue'

defineProps<{
  data: TimesheetsAdminBootstrap
  refresh: () => Promise<unknown>
}>()
</script>

<template>
  <section class="grid gap-4">
    <TimesheetsWorkspaceSettingsForm
      :settings="data.settings"
      :refresh="refresh"
    />
  </section>
</template>
