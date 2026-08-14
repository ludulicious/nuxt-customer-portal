<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { TimesheetsAdminBootstrap } from '@nuxt-customer-portal/timesheets/app/composables/useTimesheets'
import type { ProjectDto } from '@nuxt-customer-portal/timesheets/shared/types/timesheet'

const props = defineProps<{ data: TimesheetsAdminBootstrap, refresh: () => Promise<unknown> }>()
const route = useRoute()
const { t } = useI18n()
const toast = useToast()
const timesheets = useTimesheets()
const busy = ref(false)
const formOpen = ref(false)
const projectFormRef = ref<ComponentPublicInstance | null>(null)
const listScrollTop = ref(Math.max(0, Number(route.query.scroll) || 0))
const form = reactive({ clientOrganizationId: '', name: '', code: '', budgetHours: null as number | null, budgetAmount: null as number | null, activityTypeIds: [] as string[] })
const listing = useTimesheetsAdminList<ProjectDto>({ endpoint: '/api/timesheets/admin/projects', filterKeys: ['clientOrganizationId', 'status'], defaultFilters: { status: 'ACTIVE' }, defaultSort: 'name' })
const activeProjects = listing.items
const projectFilters = computed(() => [
  { key: 'clientOrganizationId', placeholder: t('features.timesheets.admin.list.clientFilter'), items: [{ label: t('features.timesheets.admin.list.allClients'), value: undefined }, ...props.data.clients.map(client => ({ label: client.name, value: client.organizationId }))] },
  { key: 'status', placeholder: t('features.timesheets.admin.list.projectStatusFilter'), items: [{ label: t('features.timesheets.admin.list.allProjectStatuses'), value: 'ALL' }, { label: t('features.timesheets.admin.projectStatus.active'), value: 'ACTIVE' }, { label: t('features.timesheets.admin.projectStatus.archived'), value: 'ARCHIVED' }] }
])
const sortOptions = computed(() => [{ label: t('features.timesheets.admin.list.sortName'), value: 'name' }, { label: t('features.timesheets.admin.list.sortClient'), value: 'clientName' }, { label: t('features.timesheets.admin.list.sortStartDate'), value: 'startsOn' }])
const formatHours = (minutes: number) => `${(minutes / 60).toFixed(2)} h`
const formatMoney = (minor: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency: props.data.settings.currency }).format(minor / 100)
const statusColor = (status: ProjectDto['status']) => status === 'ACTIVE' ? 'success' : 'neutral'
const statusLabel = (status: ProjectDto['status']) => t(`features.timesheets.admin.projectStatus.${status.toLowerCase()}`)

const returnPath = computed(() => {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(route.query)) {
    const selected = Array.isArray(value) ? value[0] : value
    if (selected != null && key !== 'scroll') query.set(key, String(selected))
  }
  if (listScrollTop.value > 0) query.set('scroll', String(Math.round(listScrollTop.value)))
  const suffix = query.toString()
  return suffix ? `/admin/timesheets/projects?${suffix}` : '/admin/timesheets/projects'
})
const projectDetailTo = (project: { id: string }) => ({ path: `/admin/timesheets/projects/${project.id}`, query: { returnTo: returnPath.value } })
const resetForm = () => { Object.assign(form, { clientOrganizationId: '', name: '', code: '', budgetHours: null, budgetAmount: null, activityTypeIds: [] }); formOpen.value = false }
const openNew = async () => {
  resetForm()
  formOpen.value = true
  await nextTick()
  const formElement = projectFormRef.value?.$el as HTMLElement | undefined
  formElement?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
const save = async () => {
  busy.value = true
  try {
    const created = await timesheets.createProject({ clientOrganizationId: form.clientOrganizationId, name: form.name, code: form.code || null, budgetMinutes: form.budgetHours ? Math.round(form.budgetHours * 60) : null, budgetMinor: form.budgetAmount ? Math.round(form.budgetAmount * 100) : null, activityTypeIds: form.activityTypeIds })
    resetForm()
    await Promise.all([props.refresh(), listing.refresh()])
    toast.add({ title: t('features.timesheets.messages.projectCreated'), color: 'success' })
    await navigateTo({ path: `/admin/timesheets/projects/${created.id}`, query: { returnTo: returnPath.value } })
  } catch (error) {
    toast.add({ title: t('features.timesheets.messages.saveError'), description: String(error), color: 'error' })
  } finally {
    busy.value = false
  }
}
const addActivity = async (input: { name: string, billable: boolean }) => {
  busy.value = true
  try {
    await timesheets.createActivity(input)
    await props.refresh()
    return props.data.activities.find(activity => activity.name === input.name)?.id
  } finally {
    busy.value = false
  }
}
onKeyStroke('Escape', () => { if (formOpen.value) resetForm() })
defineExpose({
  canCreate: computed(() => true),
  openCreate: openNew,
  refreshList: () => listing.refresh(),
  showCreate: computed(() => Boolean(activeProjects.value.length) && !formOpen.value)
})
await listing.load()
</script>

<template>
  <section class="flex h-full min-h-0 flex-col gap-5">
    <TimesheetsAdminListToolbar v-model:search="listing.search.value" :filters="projectFilters" :filter-values="listing.filters" :sort-options="sortOptions" :sort-by="listing.sortBy.value" :sort-dir="listing.sortDir.value" @filter="listing.setFilter" @sort="listing.sortBy.value = $event" @toggle-direction="listing.toggleSortDir" />
    <TimesheetsAdminPaginatedList class="min-h-0 flex-1" :pagination="listing.pagination.value" :pending="listing.pending.value" :loading-next="listing.loadingNextPage.value" :loading-previous="listing.loadingPreviousPage.value" :has-next="listing.hasNextPage.value" :has-previous="listing.hasPreviousPage.value" :initial-scroll-top="listScrollTop" @scroll="listScrollTop = $event" @next="listing.loadNext" @previous="listing.loadPrevious" @page="listing.goToPage">
      <TimesheetsAdminEmptyState v-if="!activeProjects.length && !formOpen && !listing.pending.value" icon="i-lucide-folder-kanban" :title="t('features.timesheets.admin.noProjectsTitle')" :description="t('features.timesheets.admin.noProjectsDescription')" :action-label="t('features.timesheets.admin.createFirstProject')" @action="openNew" />
      <div class="grid gap-3">
        <TimesheetsProjectForm v-if="formOpen" ref="projectFormRef" v-model="form" :data="data" :editing="false" :busy="busy" :show-cancel="true" :add-activity="addActivity" @submit="save" @cancel="resetForm" />
        <UCard v-for="project in activeProjects" :key="project.id" class="transition-colors hover:ring-1 hover:ring-primary/50">
          <div class="grid grid-cols-[minmax(0,1fr)_2.75rem] items-center gap-3">
            <NuxtLink :to="projectDetailTo(project)" class="group min-w-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
              <div class="flex flex-wrap items-center gap-2"><p class="font-semibold">{{ project.name }}</p><UBadge :color="statusColor(project.status)" variant="subtle">{{ statusLabel(project.status) }}</UBadge></div>
              <p class="mt-1 text-sm text-muted">{{ project.clientName }}{{ project.code ? ` · ${project.code}` : '' }}</p>
              <div class="mt-3 flex flex-wrap gap-2 text-xs text-muted"><span>{{ project.activityTypeIds.length }} {{ t('features.timesheets.admin.activities').toLowerCase() }}</span><span v-if="project.budgetMinutes">· {{ formatHours(project.budgetMinutes) }}</span><span v-if="project.budgetMinor">· {{ formatMoney(project.budgetMinor) }}</span></div>
            </NuxtLink>
            <NuxtLink :to="projectDetailTo(project)" :aria-label="t('features.timesheets.admin.openProject', { name: project.name })" class="grid size-11 place-items-center justify-self-end rounded focus-visible:outline-2 focus-visible:outline-primary"><UIcon name="i-lucide-chevron-right" class="size-5 text-muted" /></NuxtLink>
          </div>
        </UCard>
      </div>
    </TimesheetsAdminPaginatedList>
  </section>
</template>
