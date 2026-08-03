<script setup lang="ts">
/* eslint-disable @stylistic/max-statements-per-line */
import type { ComponentPublicInstance, DeepReadonly } from 'vue'
import type { ProjectDto } from '#layers/timesheets/shared/types/timesheet'
import type { TimesheetsAdminBootstrap } from '#layers/timesheets/app/composables/useTimesheets'

const props = defineProps<{ data: TimesheetsAdminBootstrap, refresh: () => Promise<unknown> }>()
const { t } = useI18n()
const toast = useToast()
const timesheets = useTimesheets()
const busy = ref(false)
const formOpen = ref(false)
const editingId = ref('')
const deletionId = ref('')
const deletionName = ref('')
const deletionPending = ref(false)
const eligibility = ref<{ projectId: string, projectName: string, canDelete: boolean } | null>(null)
const projectFormRef = ref<ComponentPublicInstance | null>(null)
const form = reactive({ clientOrganizationId: '', name: '', code: '', budgetHours: null as number | null, budgetAmount: null as number | null, activityTypeIds: [] as string[] })
const rateDrafts = reactive<Record<string, Record<string, number | null>>>({})
const listing = useTimesheetsAdminList<TimesheetsAdminBootstrap['projects'][number]>({ endpoint: '/api/timesheets/admin/projects', filterKeys: ['clientOrganizationId'], defaultSort: 'name' })
const activeProjects = listing.items
const clientFilters = computed(() => [{ key: 'clientOrganizationId', placeholder: t('features.timesheets.admin.list.clientFilter'), items: [{ label: t('features.timesheets.admin.list.allClients'), value: undefined }, ...props.data.clients.map(client => ({ label: client.name, value: client.organizationId }))] }])
const sortOptions = computed(() => [{ label: t('features.timesheets.admin.list.sortName'), value: 'name' }, { label: t('features.timesheets.admin.list.sortClient'), value: 'clientName' }, { label: t('features.timesheets.admin.list.sortStartDate'), value: 'startsOn' }])
const formatHours = (minutes: number) => `${(minutes / 60).toFixed(2)} h`
const formatMoney = (minor: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency: props.data.settings.currency }).format(minor / 100)

watch([() => props.data.team, activeProjects], ([team, projects]) => {
  for (const project of projects) {
    rateDrafts[project.id] = Object.fromEntries(team.map((member) => {
      const rate = project.personRates[member.id]
      return [member.id, rate === undefined ? null : rate / 100]
    }))
  }
}, { immediate: true })
const run = async (operation: () => Promise<unknown>) => {
  busy.value = true
  try { await operation(); await props.refresh(); await listing.refresh() } catch (error) { toast.add({ title: t('features.timesheets.messages.saveError'), description: String(error), color: 'error' }) } finally { busy.value = false }
}
const resetForm = () => { Object.assign(form, { clientOrganizationId: '', name: '', code: '', budgetHours: null, budgetAmount: null, activityTypeIds: [] }); editingId.value = ''; formOpen.value = false }
const resetDeletion = () => { deletionId.value = ''; deletionName.value = ''; deletionPending.value = false; eligibility.value = null }
const openNew = () => { resetDeletion(); resetForm(); formOpen.value = true }
const scrollToProjectForm = async () => {
  if (!import.meta.client) return
  await nextTick()
  const formElement = projectFormRef.value?.$el as HTMLElement | undefined
  if (!formElement) return
  const headerHeight = document.querySelector('header')?.getBoundingClientRect().height || 72
  const availableHeight = window.innerHeight - headerHeight - 32
  formElement.scrollIntoView({ behavior: 'smooth', block: formElement.offsetHeight <= availableHeight ? 'center' : 'start' })
  formElement.querySelector<HTMLElement>('textarea:not([disabled]), input:not([disabled]), select:not([disabled]), button[role="combobox"]:not([disabled])')?.focus({ preventScroll: true })
}
const openEditor = (project: DeepReadonly<ProjectDto>) => {
  if (formOpen.value && editingId.value === project.id) return resetForm()
  resetDeletion(); editingId.value = project.id; Object.assign(form, { clientOrganizationId: project.clientOrganizationId, name: project.name, code: project.code ?? '', budgetHours: project.budgetMinutes === null ? null : project.budgetMinutes / 60, budgetAmount: project.budgetMinor === null ? null : project.budgetMinor / 100, activityTypeIds: [...project.activityTypeIds] }); formOpen.value = true
  void scrollToProjectForm()
}
const save = () => run(async () => {
  const payload = { clientOrganizationId: form.clientOrganizationId, name: form.name, code: form.code || null, budgetMinutes: form.budgetHours ? Math.round(form.budgetHours * 60) : null, budgetMinor: form.budgetAmount ? Math.round(form.budgetAmount * 100) : null, activityTypeIds: form.activityTypeIds }
  if (editingId.value) await timesheets.updateProject(editingId.value, payload); else await timesheets.createProject(payload)
  resetForm()
})
const addActivity = async (input: { name: string, billable: boolean }) => {
  await run(() => timesheets.createActivity(input))
  return props.data.activities.find(activity => activity.name === input.name)?.id
}
const openDeletion = async (id: string) => {
  if (deletionId.value === id) return resetDeletion()
  resetForm(); deletionId.value = id; deletionName.value = ''; eligibility.value = null; deletionPending.value = true
  try { const result = await timesheets.getProjectDeletionEligibility(id); if (deletionId.value === id) eligibility.value = result } catch (error) { toast.add({ title: t('features.timesheets.messages.saveError'), description: String(error), color: 'error' }); resetDeletion() } finally { if (deletionId.value === id) deletionPending.value = false }
}
const confirmDeletion = () => {
  if (!eligibility.value?.canDelete || deletionName.value !== eligibility.value.projectName) return
  return run(async () => { await timesheets.deleteProject(eligibility.value!.projectId, deletionName.value); resetDeletion() })
}
const setRateDraft = (projectId: string, userId: string, value: unknown) => { rateDrafts[projectId] ??= {}; rateDrafts[projectId][userId] = value === '' || value === null ? null : Number(value) }
const saveRates = (projectId: string) => run(() => timesheets.updateProject(projectId, { personRates: Object.fromEntries(Object.entries(rateDrafts[projectId] ?? {}).filter(([, value]) => value !== null && value !== undefined).map(([id, value]) => [id, Math.round(Number(value) * 100)])) }))
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
    <TimesheetsAdminListToolbar v-model:search="listing.search.value" :filters="clientFilters" :filter-values="listing.filters" :sort-options="sortOptions" :sort-by="listing.sortBy.value" :sort-dir="listing.sortDir.value" @filter="listing.setFilter" @sort="listing.sortBy.value = $event" @toggle-direction="listing.toggleSortDir" />
    <TimesheetsAdminPaginatedList class="min-h-0 flex-1" :pagination="listing.pagination.value" :pending="listing.pending.value" :loading-next="listing.loadingNextPage.value" :loading-previous="listing.loadingPreviousPage.value" :has-next="listing.hasNextPage.value" :has-previous="listing.hasPreviousPage.value" @next="listing.loadNext" @previous="listing.loadPrevious" @page="listing.goToPage">
      <TimesheetsAdminEmptyState v-if="!activeProjects.length && !formOpen && !listing.pending.value" icon="i-lucide-folder-kanban" :title="t('features.timesheets.admin.noProjectsTitle')" :description="t('features.timesheets.admin.noProjectsDescription')" :action-label="t('features.timesheets.admin.createFirstProject')" @action="openNew" />
      <div class="grid gap-3">
      <template v-for="(project, index) in activeProjects" :key="project.id">
        <UCard :style="{ order: index * 2 }" class="cursor-pointer transition-colors hover:ring-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" :class="{ 'ring-2 ring-primary': formOpen && editingId === project.id }" role="button" tabindex="0" @click="openEditor(project)" @keydown.enter="openEditor(project)" @keydown.space.prevent="openEditor(project)">
          <div class="flex items-start justify-between gap-3"><div><p class="font-medium">{{ project.name }}</p><p class="text-sm text-muted">{{ project.clientName }}{{ project.code ? ` · ${project.code}` : '' }}</p></div><div class="flex items-center gap-1"><UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-pencil" :aria-label="t('features.timesheets.admin.editProject')" :aria-expanded="formOpen && editingId === project.id" @click.stop="openEditor(project)" @keydown.stop /><UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" :aria-label="t('features.timesheets.admin.deleteProject')" :aria-expanded="deletionId === project.id" @click.stop="openDeletion(project.id)" @keydown.stop /><UBadge color="success" variant="subtle">{{ project.status }}</UBadge></div></div>
          <div class="mt-4 flex flex-wrap gap-2 text-xs text-muted"><span>{{ project.activityTypeIds.length }} {{ t('features.timesheets.admin.activities').toLowerCase() }}</span><span v-if="project.budgetMinutes">· {{ formatHours(project.budgetMinutes) }}</span><span v-if="project.budgetMinor">· {{ formatMoney(project.budgetMinor) }}</span></div>
          <details class="mt-4 border-t border-muted pt-4" @click.stop @keydown.stop><summary class="cursor-pointer text-sm font-medium">{{ t('features.timesheets.admin.projectRates') }}</summary><div class="mt-3 space-y-3"><div v-for="member in data.team" :key="member.id" class="flex items-center gap-3"><span class="min-w-0 flex-1 truncate text-sm">{{ member.name }}</span><UInput :model-value="rateDrafts[project.id]?.[member.id] ?? undefined" type="number" min="0" step="0.01" :placeholder="member.defaultHourlyRateMinor === null ? '—' : String(member.defaultHourlyRateMinor / 100)" class="w-28" @update:model-value="setRateDraft(project.id, member.id, $event)" /></div><div class="flex justify-end"><UButton size="sm" variant="outline" icon="i-lucide-save" @click="saveRates(project.id)">{{ t('features.timesheets.admin.saveOverrides') }}</UButton></div></div></details>
        </UCard>
        <UCard v-if="deletionId === project.id" :style="{ order: index * 2 + 1 }" class="border-error">
          <template #header><h2 class="font-semibold text-error">{{ t('features.timesheets.admin.deleteProject') }}</h2></template>
          <div v-if="deletionPending" class="flex items-center gap-2 text-sm text-muted"><UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />{{ t('features.timesheets.admin.checkingProjectDeletion') }}</div>
          <template v-else-if="eligibility"><div class="flex items-center gap-2 text-sm" :class="eligibility.canDelete ? 'text-success' : 'text-error'"><UIcon :name="eligibility.canDelete ? 'i-lucide-circle-check' : 'i-lucide-circle-x'" class="size-5 shrink-0" />{{ t(eligibility.canDelete ? 'features.timesheets.admin.projectHasNoTimeEntries' : 'features.timesheets.admin.projectHasTimeEntries') }}</div><div v-if="eligibility.canDelete" class="mt-4 space-y-4"><p class="text-sm text-muted">{{ t('features.timesheets.admin.typeProjectNameToDelete', { name: project.name }) }}</p><UFormField :label="t('features.timesheets.admin.projectNameConfirmation')"><UInput v-model="deletionName" :placeholder="project.name" autocomplete="off" class="w-full" /></UFormField><div class="flex justify-end gap-2"><UButton color="neutral" variant="ghost" @click="resetDeletion">{{ t('features.timesheets.cancel') }}</UButton><UButton color="error" icon="i-lucide-trash-2" :loading="busy" :disabled="deletionName !== project.name" @click="confirmDeletion">{{ t('features.timesheets.admin.deleteProject') }}</UButton></div></div><div v-else class="mt-4 flex justify-end"><UButton color="neutral" variant="ghost" @click="resetDeletion">{{ t('features.timesheets.cancel') }}</UButton></div></template>
        </UCard>
      </template>
      <TimesheetsProjectForm
        v-if="formOpen"
        ref="projectFormRef"
        v-model="form"
        class="entity-editor"
        :data="data"
        :editing="Boolean(editingId)"
        :busy="busy"
        :show-cancel="true"
        :add-activity="addActivity"
        :style="{ order: editingId ? activeProjects.findIndex(project => project.id === editingId) * 2 + 1 : -1 }"
        @submit="save"
        @cancel="resetForm"
      />
      </div>
    </TimesheetsAdminPaginatedList>
  </section>
</template>

<style scoped>
.entity-editor { scroll-margin-top: calc(var(--ui-header-height) + 1rem); }
</style>
