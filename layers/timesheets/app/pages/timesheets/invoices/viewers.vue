<script setup lang="ts">
const { t } = useI18n()
const api = useTimesheets()
const route = useRoute()
const toast = useToast()
const selectedId = ref(typeof route.query.supplier === 'string' ? route.query.supplier : '')
const { data: suppliers, refresh: refreshSuppliers } = await useAsyncData('timesheet-invoice-viewer-suppliers', api.clientInvoiceSuppliers)
watchEffect(() => {
  if (!selectedId.value && suppliers.value?.length) selectedId.value = suppliers.value[0]!.id
})
const { data: viewers, refresh } = await useAsyncData('timesheet-invoice-viewers', async () => selectedId.value ? api.clientInvoiceViewers(selectedId.value) : [], { watch: [selectedId] })
const selected = computed(() => suppliers.value?.find(item => item.id === selectedId.value))
const toggle = async (userId: string, assigned: boolean) => {
  try {
    await api.setClientInvoiceViewer(selectedId.value, userId, assigned)
    await Promise.all([refresh(), refreshSuppliers()])
    window.dispatchEvent(new CustomEvent('timesheets:capabilities-refresh'))
  } catch {
    toast.add({ title: t('features.timesheets.messages.saveError'), color: 'error' })
  }
}
useSeoMeta({ title: () => t('features.timesheets.clientInvoices.viewersTitle') })
</script>

<template>
  <div class="mx-auto h-full max-w-6xl overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
    <header class="border-b border-default pb-5"><h1 class="text-2xl font-semibold">{{ t('features.timesheets.clientInvoices.viewersTitle') }}</h1><p class="mt-1 text-sm text-muted">{{ t('features.timesheets.clientInvoices.viewersSubtitle') }}</p></header>
    <UAlert v-if="!suppliers?.length" class="mt-6" icon="i-lucide-receipt-text" :title="t('features.timesheets.clientInvoices.noSuppliers')" variant="outline" />
    <div v-else class="grid gap-6 py-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <nav class="space-y-2" :aria-label="t('features.timesheets.clientInvoices.suppliersLabel')"><button v-for="item in suppliers" :key="item.id" type="button" class="w-full rounded-md border p-3 text-left focus-visible:outline-2 focus-visible:outline-primary" :class="selectedId === item.id ? 'border-primary bg-primary/5' : 'border-default hover:bg-elevated/50'" @click="selectedId = item.id"><span class="font-medium">{{ item.workspaceName }}</span><span class="mt-1 block text-xs text-muted">{{ t('features.timesheets.clientInvoices.viewerCount', { count: item.viewerCount }) }}</span></button></nav>
      <section v-if="selected" class="rounded-lg border border-default bg-default"><header class="border-b border-default p-5"><h2 class="text-lg font-semibold">{{ selected.workspaceName }}</h2><p class="mt-1 text-sm text-muted">{{ t('features.timesheets.clientInvoices.viewerHelp') }}</p></header><div class="divide-y divide-default"><label v-for="person in viewers" :key="person.id" class="flex items-center gap-3 p-4 hover:bg-elevated/40"><USwitch :model-value="person.assigned" @update:model-value="toggle(person.id, $event)" /><span class="min-w-0"><strong class="block text-sm">{{ person.name }}</strong><span class="block truncate text-xs text-muted">{{ person.email }}</span></span></label></div><footer class="border-t border-default p-4 text-xs text-muted">{{ t('features.timesheets.clientInvoices.adminAccessHelp') }}</footer></section>
    </div>
  </div>
</template>
