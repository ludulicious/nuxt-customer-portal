<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()

useSeoMeta({ title: () => t('features.timesheets.approvals.title') })
</script>

<template>
  <NuxtPage v-if="route.path !== '/timesheets/approvals'" />
  <TimesheetsPageShell v-else class="space-y-6 overflow-y-auto">
    <TimesheetsReviewRequests client-side />
    <h2 class="text-xl font-semibold">{{ t('features.timesheets.reviewPeriods.legacy') }}</h2>
    <TimesheetsClientTimesheetBrowser mode="review" />
  </TimesheetsPageShell>
</template>
