<script setup lang="ts">
/* eslint-disable @stylistic/max-statements-per-line */
import type { ComponentPublicInstance } from 'vue'
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
const eligibility = ref<{ activityId: string, activityName: string, canDelete: boolean } | null>(null)
const activityFormRef = ref<ComponentPublicInstance | null>(null)
const form = reactive({ name: '', billable: true })
const listing = useTimesheetsAdminList<TimesheetsAdminBootstrap['activities'][number]>({ endpoint: '/api/timesheets/admin/activities', filterKeys: ['active', 'billable'], defaultSort: 'name' })
const activityFilters = computed(() => [
  { key: 'active', placeholder: t('features.timesheets.admin.list.statusFilter'), items: [{ label: t('features.timesheets.admin.list.allStatuses'), value: undefined }, { label: t('features.timesheets.admin.active'), value: 'true' }, { label: t('features.timesheets.admin.inactive'), value: 'false' }] },
  { key: 'billable', placeholder: t('features.timesheets.admin.list.billingFilter'), items: [{ label: t('features.timesheets.admin.list.allBilling'), value: undefined }, { label: t('features.timesheets.admin.list.billable'), value: 'true' }, { label: t('features.timesheets.admin.list.nonBillable'), value: 'false' }] }
])
const sortOptions = computed(() => [{ label: t('features.timesheets.admin.list.sortName'), value: 'name' }, { label: t('features.timesheets.admin.list.sortActive'), value: 'active' }, { label: t('features.timesheets.admin.list.sortBilling'), value: 'billable' }])

const run = async (operation: () => Promise<unknown>) => {
  busy.value = true
  try { await operation(); await props.refresh(); await listing.refresh() } catch (error) {
    toast.add({ title: t('features.timesheets.messages.saveError'), description: String(error), color: 'error' })
  } finally { busy.value = false }
}
const resetForm = () => { Object.assign(form, { name: '', billable: true }); editingId.value = ''; formOpen.value = false }
const resetDeletion = () => { deletionId.value = ''; deletionName.value = ''; deletionPending.value = false; eligibility.value = null }
const openNew = () => { resetDeletion(); resetForm(); formOpen.value = true }
const scrollToActivityForm = async () => {
  if (!import.meta.client) return
  await nextTick()
  const formElement = activityFormRef.value?.$el as HTMLElement | undefined
  if (!formElement) return
  const headerHeight = document.querySelector('header')?.getBoundingClientRect().height || 72
  const availableHeight = window.innerHeight - headerHeight - 32
  formElement.scrollIntoView({ behavior: 'smooth', block: formElement.offsetHeight <= availableHeight ? 'center' : 'start' })
  formElement.querySelector<HTMLElement>('textarea:not([disabled]), input:not([disabled]), select:not([disabled]), button[role="combobox"]:not([disabled])')?.focus({ preventScroll: true })
}
const openEditor = (activity: TimesheetsAdminBootstrap['activities'][number]) => {
  if (formOpen.value && editingId.value === activity.id) return resetForm()
  resetDeletion(); editingId.value = activity.id; Object.assign(form, { name: activity.name, billable: activity.billable }); formOpen.value = true
  void scrollToActivityForm()
}
const save = () => run(async () => {
  if (editingId.value) await timesheets.updateActivity(editingId.value, form)
  else await timesheets.createActivity(form)
  resetForm()
})
const openDeletion = async (id: string) => {
  if (deletionId.value === id) return resetDeletion()
  resetForm(); deletionId.value = id; deletionName.value = ''; eligibility.value = null; deletionPending.value = true
  try { const result = await timesheets.getActivityDeletionEligibility(id); if (deletionId.value === id) eligibility.value = result } catch (error) {
    toast.add({ title: t('features.timesheets.messages.saveError'), description: String(error), color: 'error' }); resetDeletion()
  } finally { if (deletionId.value === id) deletionPending.value = false }
}
const confirmDeletion = () => {
  if (!eligibility.value?.canDelete || deletionName.value !== eligibility.value.activityName) return
  return run(async () => { await timesheets.deleteActivity(eligibility.value!.activityId, deletionName.value); resetDeletion() })
}
const toggleActive = (id: string, active: boolean) => run(() => timesheets.updateActivity(id, { active }))
onKeyStroke('Escape', () => { if (formOpen.value) resetForm() })
defineExpose({
  canCreate: computed(() => true),
  openCreate: openNew,
  refreshList: () => listing.refresh(),
  showCreate: computed(() => Boolean(listing.items.value.length) && !formOpen.value)
})
await listing.load()
</script>

<template>
  <section class="flex h-full min-h-0 flex-col gap-5">
    <TimesheetsAdminListToolbar v-model:search="listing.search.value" :filters="activityFilters" :filter-values="listing.filters" :sort-options="sortOptions" :sort-by="listing.sortBy.value" :sort-dir="listing.sortDir.value" @filter="listing.setFilter" @sort="listing.sortBy.value = $event" @toggle-direction="listing.toggleSortDir" />
    <TimesheetsAdminPaginatedList class="min-h-0 flex-1" :pagination="listing.pagination.value" :pending="listing.pending.value" :loading-next="listing.loadingNextPage.value" :loading-previous="listing.loadingPreviousPage.value" :has-next="listing.hasNextPage.value" :has-previous="listing.hasPreviousPage.value" @next="listing.loadNext" @previous="listing.loadPrevious" @page="listing.goToPage">
      <TimesheetsAdminEmptyState v-if="!listing.items.value.length && !formOpen && !listing.pending.value" icon="i-lucide-tags" :title="t('features.timesheets.admin.noActivitiesTitle')" :description="t('features.timesheets.admin.noActivitiesDescription')" :action-label="t('features.timesheets.admin.createFirstActivity')" @action="openNew" />
      <div class="grid gap-3">
      <template v-for="(activity, index) in listing.items.value" :key="activity.id">
        <UCard :style="{ order: index * 2 }" class="cursor-pointer transition-colors hover:ring-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" :class="{ 'ring-2 ring-primary': formOpen && editingId === activity.id }" role="button" tabindex="0" @click="openEditor(activity)" @keydown.enter="openEditor(activity)" @keydown.space.prevent="openEditor(activity)">
<div class="flex items-center justify-between gap-3">
          <div><p class="font-medium">{{ activity.name }}</p><p class="text-sm text-muted">{{ activity.billable ? t('features.timesheets.billable') : t('features.timesheets.nonBillable') }}</p></div>
          <div class="flex items-center gap-1">
            <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-pencil" :aria-label="t('features.timesheets.admin.editActivity')" :aria-expanded="formOpen && editingId === activity.id" @click.stop="openEditor(activity)" @keydown.stop />
            <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" :aria-label="t('features.timesheets.admin.deleteActivity')" :aria-expanded="deletionId === activity.id" @click.stop="openDeletion(activity.id)" @keydown.stop />
            <span @click.stop @keydown.stop><USwitch :model-value="activity.active" :aria-label="t('features.timesheets.admin.active')" @update:model-value="toggleActive(activity.id, $event)" /></span>
          </div>
        </div>
</UCard>
        <UCard v-if="deletionId === activity.id" :style="{ order: index * 2 + 1 }" class="border-error">
          <template #header><h2 class="font-semibold text-error">{{ t('features.timesheets.admin.deleteActivity') }}</h2></template>
          <div v-if="deletionPending" class="flex items-center gap-2 text-sm text-muted"><UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />{{ t('features.timesheets.admin.checkingActivityDeletion') }}</div>
          <template v-else-if="eligibility">
            <div class="flex items-center gap-2 text-sm" :class="eligibility.canDelete ? 'text-success' : 'text-error'"><UIcon :name="eligibility.canDelete ? 'i-lucide-circle-check' : 'i-lucide-circle-x'" class="size-5 shrink-0" />{{ t(eligibility.canDelete ? 'features.timesheets.admin.activityHasNoTimeEntries' : 'features.timesheets.admin.activityHasTimeEntries') }}</div>
            <div v-if="eligibility.canDelete" class="mt-4 space-y-4">
              <p class="text-sm text-muted">{{ t('features.timesheets.admin.typeActivityNameToDelete', { name: activity.name }) }}</p>
              <UFormField :label="t('features.timesheets.admin.activityNameConfirmation')"><UInput v-model="deletionName" :placeholder="activity.name" autocomplete="off" class="w-full" /></UFormField>
              <div class="flex justify-end gap-2"><UButton color="neutral" variant="ghost" @click="resetDeletion">{{ t('features.timesheets.cancel') }}</UButton><UButton color="error" icon="i-lucide-trash-2" :loading="busy" :disabled="deletionName !== activity.name" @click="confirmDeletion">{{ t('features.timesheets.admin.deleteActivity') }}</UButton></div>
            </div>
            <div v-else class="mt-4 flex justify-end"><UButton color="neutral" variant="ghost" @click="resetDeletion">{{ t('features.timesheets.cancel') }}</UButton></div>
          </template>
        </UCard>
      </template>
      <TimesheetsActivityForm
        v-if="formOpen"
        ref="activityFormRef"
        v-model="form"
        class="entity-editor"
        :editing="Boolean(editingId)"
        :busy="busy"
        :show-cancel="true"
        :style="{ order: editingId ? listing.items.value.findIndex(activity => activity.id === editingId) * 2 + 1 : -1 }"
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
