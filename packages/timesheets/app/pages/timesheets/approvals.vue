<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()

useSeoMeta({ title: () => t('features.timesheets.approvals.title') })
</script>

<template>
  <NuxtPage v-if="route.path !== '/timesheets/approvals'" />
  <TimesheetsClientTimesheetBrowser v-else mode="review" />
</template>
