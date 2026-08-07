<script setup lang="ts">
const { t } = useI18n()
const toast = useToast()
const timesheets = useTimesheets()
const search = ref('')
const busyId = ref<string | null>(null)
const { data, pending, refresh } = await useAsyncData('timesheets-internal-approval-configuration', timesheets.internalApprovalConfiguration)
const members = computed(() => (data.value?.members ?? []).filter(member => {
  const query = search.value.trim().toLocaleLowerCase()
  return !query || member.name.toLocaleLowerCase().includes(query) || member.email.toLocaleLowerCase().includes(query)
}))
const optionsFor = (userId: string) => (data.value?.members ?? []).filter(member => member.id !== userId).map(member => ({ label: `${member.name} · ${member.email}`, value: member.id }))
const saveWorkspace = async (enabled: boolean) => {
  busyId.value = 'workspace'
  try {
    await timesheets.updateInternalApprovalWorkspace(enabled)
    await refresh()
    if (import.meta.client) window.dispatchEvent(new Event('timesheets:capabilities-refresh'))
  } catch (error) {
    toast.add({ title: t('features.timesheets.messages.saveError'), description: String(error), color: 'error' })
  } finally { busyId.value = null }
}
const saveMember = async (userId: string, required: boolean, approverUserIds: string[]) => {
  busyId.value = userId
  try {
    await timesheets.updateInternalApprovalMember(userId, { required, approverUserIds })
    await refresh()
    if (import.meta.client) window.dispatchEvent(new Event('timesheets:capabilities-refresh'))
  } catch (error) {
    toast.add({ title: t('features.timesheets.messages.saveError'), description: String(error), color: 'error' })
    await refresh()
  } finally { busyId.value = null }
}
useSeoMeta({ title: () => t('features.timesheets.internalApprovals.manageTitle') })
</script>

<template>
  <TimesheetsPageShell class="h-full min-h-0 space-y-6 overflow-y-auto">
    <header>
      <div class="flex items-center gap-2"><UIcon name="i-lucide-user-round-check" class="size-6" /><h1 class="text-2xl font-semibold text-highlighted">{{ t('features.timesheets.internalApprovals.manageTitle') }}</h1></div>
      <p class="mt-1 text-sm text-muted">{{ t('features.timesheets.internalApprovals.manageSubtitle') }}</p>
    </header>
    <div v-if="pending && !data" class="flex justify-center py-12 text-muted"><UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" /></div>
    <template v-else-if="data">
      <UCard>
        <div class="flex items-center justify-between gap-4">
          <div><p class="font-medium">{{ t('features.timesheets.internalApprovals.enabled') }}</p><p class="text-sm text-muted">{{ t('features.timesheets.internalApprovals.enabledHelp') }}</p></div>
          <USwitch :model-value="data.enabled" :loading="busyId === 'workspace'" :aria-label="t('features.timesheets.internalApprovals.enabled')" @update:model-value="saveWorkspace" />
        </div>
      </UCard>
      <UInput v-model="search" icon="i-lucide-search" :placeholder="t('features.timesheets.internalApprovals.search')" class="w-full" />
      <section class="grid gap-3">
        <UCard v-for="member in members" :key="member.id">
          <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(18rem,1fr)] lg:items-center">
            <div class="flex min-w-0 items-center gap-3"><UAvatar :src="member.image ?? undefined" :alt="member.name" /><div class="min-w-0"><p class="truncate font-medium">{{ member.name }}</p><p class="truncate text-sm text-muted">{{ member.email }}</p></div></div>
            <UFormField :label="t('features.timesheets.internalApprovals.required')">
              <USwitch :model-value="member.internalApprovalRequired" :disabled="!data.enabled || busyId === member.id" @update:model-value="saveMember(member.id, $event, $event ? member.approverUserIds : [])" />
            </UFormField>
            <UFormField :label="t('features.timesheets.internalApprovals.approvers')" :description="t('features.timesheets.internalApprovals.approversHelp')">
              <USelectMenu :model-value="member.approverUserIds" multiple :items="optionsFor(member.id)" value-key="value" class="w-full" :disabled="!data.enabled || !member.internalApprovalRequired || busyId === member.id" @update:model-value="saveMember(member.id, true, $event)" />
            </UFormField>
          </div>
        </UCard>
        <UCard v-if="!members.length"><p class="py-8 text-center text-sm text-muted">{{ t('features.timesheets.internalApprovals.emptySearch') }}</p></UCard>
      </section>
    </template>
  </TimesheetsPageShell>
</template>
