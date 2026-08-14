<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const timesheets = useTimesheets()
const projectId = computed(() => String(route.params.id))
const returnTo = computed(() => {
  const value = Array.isArray(route.query.returnTo) ? route.query.returnTo[0] : route.query.returnTo
  return typeof value === 'string' && (value === '/admin/timesheets/projects' || value.startsWith('/admin/timesheets/projects?')) ? value : '/admin/timesheets/projects'
})
const { data: project, pending: projectPending, error, refresh: refreshProject } = await useAsyncData(`timesheets-project-${projectId.value}`, () => timesheets.getProject(projectId.value))
const { data, pending: dataPending, refresh: refreshData } = await useAsyncData('timesheets-admin-project-detail', () => timesheets.adminBootstrap('projects'))
const pending = computed(() => projectPending.value || dataPending.value)
useSeoMeta({ title: computed(() => project.value?.name ?? t('features.timesheets.admin.projects')) })
const handleDeleted = async () => { await navigateTo(returnTo.value) }
</script>

<template>
  <TimesheetsPageShell class="timesheet-admin h-full min-h-0 overflow-y-auto" :setup-status="data?.setupStatus">
    <UButton :to="returnTo" variant="link" color="neutral" icon="i-lucide-arrow-left" class="mb-4 w-fit px-0">{{ t('features.timesheets.admin.backToProjects') }}</UButton>
    <div v-if="pending" class="flex justify-center py-12" role="status"><UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" /><span class="sr-only">{{ t('features.timesheets.admin.projectLoading') }}</span></div>
    <UAlert v-else-if="error" color="error" icon="i-lucide-circle-alert" :title="t('features.timesheets.admin.projectNotFound')" variant="outline" />
    <TimesheetsProjectDetail v-else-if="project && data" :project="project" :data="data" :refresh-project="refreshProject" :refresh-data="refreshData" @deleted="handleDeleted" />
  </TimesheetsPageShell>
</template>
