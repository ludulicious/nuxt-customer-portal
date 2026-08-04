<script setup lang="ts">
const { t, locale } = useI18n()
const api = useTimesheets()
const toast = useToast()
const selectedId = ref('')
const disputeWeekId = ref('')
const disputeComment = ref('')
const { data: workspaces } = await useAsyncData('timesheet-client-workspaces', api.clientWorkspaces)
watchEffect(() => {
  if (!selectedId.value && workspaces.value?.length) selectedId.value = workspaces.value[0]!.id
})
const { data, refresh } = await useAsyncData('timesheet-client-data', async () => selectedId.value ? api.clientTimesheets(selectedId.value) : null, { watch: [selectedId] })
const { data: reviewers, refresh: refreshReviewers } = await useAsyncData('timesheet-client-reviewers', async () => data.value?.workspace.canManageReviewers && selectedId.value ? api.clientReviewers(selectedId.value) : [], { watch: [selectedId, () => data.value?.workspace.canManageReviewers] })
const review = async (weekId: string, expectedVersion: number, action: 'APPROVE' | 'DISPUTE') => {
  try {
    await api.reviewClientSlice(selectedId.value, weekId, { action, expectedVersion, comment: action === 'DISPUTE' ? disputeComment.value : null })
    disputeWeekId.value = ''
    disputeComment.value = ''
    await refresh()
  } catch (error) { toast.add({ title: t('features.timesheets.messages.saveError'), description: String(error), color: 'error' }) }
}
const toggleReviewer = async (userId: string, assigned: boolean) => {
  await api.setClientReviewer(selectedId.value, userId, assigned)
  await refreshReviewers()
}
const hours = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
const weekNumber = (weekStartsOn: string) => {
  const date = new Date(`${weekStartsOn}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 3)
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4, 12))
  firstThursday.setUTCDate(firstThursday.getUTCDate() + 3 - ((firstThursday.getUTCDay() + 6) % 7))
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / 604_800_000)
}
const weekPeriod = (weekStartsOn: string) => {
  const start = new Date(`${weekStartsOn}T12:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const formatter = new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'long', year: 'numeric' })
  return t('features.timesheets.clientPortal.weekPeriod', { week: weekNumber(weekStartsOn), period: formatter.formatRange(start, end) })
}
const historyActionKey = (action: string) => ({ SUBMITTED: 'submitted', APPROVED_INTERNAL: 'approvedInternal', REOPENED: 'reopened', APPROVED_CLIENT: 'approvedClient', DISPUTED_CLIENT: 'disputedClient' })[action] ?? 'submitted'
const historyDate = (value: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const billingKey = (status: string) => ({ AWAITING_INVOICE: 'awaitingInvoice', PARTIALLY_INVOICED: 'partiallyInvoiced', INVOICED: 'invoiced' })[status] ?? 'awaitingInvoice'
const statusKey = (slice: NonNullable<typeof data.value>['slices'][number]) => data.value?.workspace.accessMode === 'VIEW'
  ? `features.timesheets.clientBilling.${billingKey(slice.billingStatus)}`
  : `features.timesheets.clientPortal.${slice.status.toLowerCase()}`
const statusDescriptionKey = (slice: NonNullable<typeof data.value>['slices'][number]) => data.value?.workspace.accessMode === 'VIEW'
  ? `features.timesheets.clientBilling.${billingKey(slice.billingStatus)}Description`
  : slice.status === 'PENDING' ? 'features.timesheets.clientPortal.pendingDescription' : undefined
const pageSubtitle = computed(() => data.value?.workspace.accessMode === 'VIEW' ? t('features.timesheets.clientBilling.viewSubtitle') : t('features.timesheets.clientPortal.subtitle'))
useSeoMeta({ title: () => t('features.timesheets.clientPortal.title') })
</script>

<template>
  <div class="mx-auto h-full max-w-6xl space-y-6 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
    <header><h1 class="text-2xl font-semibold">{{ t('features.timesheets.clientPortal.title') }}</h1><p class="mt-1 text-sm text-muted">{{ pageSubtitle }}</p></header>
    <UAlert v-if="!workspaces?.length" icon="i-lucide-building-2" :title="t('features.timesheets.clientPortal.noAccess')" variant="outline" />
    <template v-else>
      <UFormField :label="t('features.timesheets.clientPortal.supplier')"><USelect v-model="selectedId" :items="workspaces.map(item => ({ label: item.workspaceName, value: item.id }))" value-key="value" class="w-full sm:max-w-sm" /></UFormField>
      <UCard v-if="data?.workspace.canManageReviewers && data.workspace.accessMode === 'REVIEW'">
        <template #header><h2 class="font-semibold">{{ t('features.timesheets.clientPortal.reviewers') }}</h2><p class="text-sm text-muted">{{ t('features.timesheets.clientPortal.reviewerHelp') }}</p></template>
        <div class="grid gap-2 sm:grid-cols-2"><label v-for="person in reviewers" :key="person.id" class="flex items-center gap-3 rounded-md border border-default p-3"><USwitch :model-value="person.assigned" @update:model-value="toggleReviewer(person.id, $event)" /><span><strong class="block text-sm">{{ person.name }}</strong><span class="text-xs text-muted">{{ person.email }}</span></span></label></div>
      </UCard>
      <UCard v-for="slice in data?.slices" :key="slice.weeklyTimesheetId">
        <template #header><div class="flex flex-wrap items-center justify-between gap-2"><div><h2 class="font-semibold">{{ weekPeriod(slice.weekStartsOn) }}</h2><p class="text-sm text-muted">{{ slice.person }}</p><p v-if="slice.comment" class="text-sm text-muted">{{ slice.comment }}</p></div><UBadge :color="data?.workspace.accessMode === 'VIEW' ? slice.billingStatus === 'INVOICED' ? 'success' : 'neutral' : slice.status === 'DISPUTED' ? 'error' : slice.status === 'APPROVED' ? 'success' : 'neutral'" :title="statusDescriptionKey(slice) ? t(statusDescriptionKey(slice)!) : undefined">{{ t(statusKey(slice)) }}</UBadge></div></template>
        <div class="divide-y divide-default"><div v-for="entry in slice.entries" :key="entry.id" class="grid gap-1 py-3 sm:grid-cols-[7rem_1fr_6rem]"><span class="text-sm text-muted">{{ entry.date }}</span><div><p class="text-sm font-medium">{{ entry.project }} · {{ entry.activity }}</p><p v-if="entry.note" class="text-sm text-muted">{{ entry.note }}</p></div><strong class="text-sm sm:text-right">{{ hours(entry.minutes) }}</strong></div></div>
        <div v-if="slice.history.length" class="mt-4 border-t border-default pt-4"><h3 class="text-sm font-semibold">{{ t('features.timesheets.clientPortal.history') }}</h3><ol class="mt-3 space-y-3"><li v-for="item in [...slice.history].reverse()" :key="item.id" class="flex gap-3 text-sm"><UIcon name="i-lucide-history" class="mt-0.5 size-4 shrink-0 text-muted" /><div><p>{{ t(`features.timesheets.clientPortal.historyActions.${historyActionKey(item.action)}`, { actor: item.actorName }) }}</p><p class="text-xs text-muted">{{ historyDate(item.createdAt) }}</p><p v-if="item.comment" class="mt-1 text-muted">{{ item.comment }}</p></div></li></ol></div>
        <div v-if="data?.workspace.canReview" class="mt-4 flex flex-wrap justify-end gap-2"><UButton color="neutral" variant="outline" @click="disputeWeekId = slice.weeklyTimesheetId">{{ t('features.timesheets.clientPortal.dispute') }}</UButton><UButton @click="review(slice.weeklyTimesheetId, slice.version, 'APPROVE')">{{ t('features.timesheets.clientPortal.approve') }}</UButton></div>
        <div v-if="disputeWeekId === slice.weeklyTimesheetId" class="mt-3 space-y-2"><UTextarea v-model="disputeComment" :placeholder="t('features.timesheets.clientPortal.comment')" class="w-full" /><div class="flex justify-end gap-2"><UButton color="neutral" variant="outline" @click="disputeWeekId = ''">{{ t('features.timesheets.cancel') }}</UButton><UButton color="error" :disabled="!disputeComment.trim()" @click="review(slice.weeklyTimesheetId, slice.version, 'DISPUTE')">{{ t('features.timesheets.clientPortal.dispute') }}</UButton></div></div>
      </UCard>
    </template>
  </div>
</template>
