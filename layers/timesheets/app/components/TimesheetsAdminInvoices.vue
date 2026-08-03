<script setup lang="ts">
/* eslint-disable @stylistic/max-statements-per-line */
import { z } from 'zod'
import type { TimesheetsAdminBootstrap } from '#layers/timesheets/app/composables/useTimesheets'
import type { InvoiceDto, InvoiceableEntryDto } from '#layers/timesheets/shared/types/timesheet'

const props = defineProps<{ data: TimesheetsAdminBootstrap, refresh: () => Promise<unknown> }>()
const { t, locale } = useI18n()
const api = useTimesheets()
const toast = useToast()
const busy = ref(false)
const formOpen = ref(false)
const step = ref(1)
const source = ref<'FREE' | 'TIME' | ''>('')
const selectedProjectIds = ref<string[]>([])
const detailLevel = ref<'SUMMARY' | 'DETAILED'>('SUMMARY')
const groupBy = ref<'PROJECT' | 'PERSON' | 'ACTIVITY' | 'PERSON_ACTIVITY'>('PROJECT')
const listing = useTimesheetsAdminList<InvoiceDto>({ endpoint: '/api/timesheets/admin/invoices', filterKeys: ['status', 'clientOrganizationId', 'overdue'], defaultSort: 'issueDate', defaultSortDir: 'desc' })
const invoiceFilters = computed(() => [
  { key: 'status', placeholder: t('features.timesheets.admin.list.statusFilter'), items: [{ label: t('features.timesheets.admin.list.allStatuses'), value: undefined }, ...(['DRAFT', 'ISSUED', 'PAID', 'VOID'] as const).map(status => ({ label: t(`features.timesheets.admin.invoiceStatus.${status.toLowerCase()}`), value: status }))] },
  { key: 'clientOrganizationId', placeholder: t('features.timesheets.admin.list.clientFilter'), items: [{ label: t('features.timesheets.admin.list.allClients'), value: undefined }, ...props.data.clients.map(client => ({ label: client.name, value: client.organizationId }))] },
  { key: 'overdue', placeholder: t('features.timesheets.admin.list.overdueFilter'), items: [{ label: t('features.timesheets.admin.list.allPaymentStates'), value: undefined }, { label: t('features.timesheets.admin.list.overdue'), value: 'true' }, { label: t('features.timesheets.admin.list.notOverdue'), value: 'false' }] }
])
const sortOptions = computed(() => [{ label: t('features.timesheets.admin.list.sortIssueDate'), value: 'issueDate' }, { label: t('features.timesheets.admin.list.sortDueDate'), value: 'dueDate' }, { label: t('features.timesheets.admin.list.sortNumber'), value: 'number' }, { label: t('features.timesheets.admin.list.sortTotal'), value: 'totalMinor' }])
const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const now = new Date()
const periodFrom = ref(localDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)))
const periodTo = ref(localDate(new Date(now.getFullYear(), now.getMonth(), 0)))
const today = localDate(now)
const due = localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30))
const emptyLine = () => ({ description: '', quantityMilli: 1000, unit: 'item', unitPriceMinor: 0, vatRateBasisPoints: props.data.settings.defaultVatRateBasisPoints, timeEntryIds: [] as string[] })
const model = reactive({ clientOrganizationId: '', contactId: '', number: `${now.getFullYear()}.0001`, currency: props.data.settings.currency, issueDate: today, dueDate: due, subject: '', notes: '', lines: [emptyLine()] })
const invoiceSchema = computed(() => z.object({
  clientOrganizationId: z.string().min(1, t('features.timesheets.validation.required')),
  contactId: z.string(),
  number: z.string().trim().min(1, t('features.timesheets.validation.required')).max(60).regex(/\d+$/, t('features.timesheets.validation.invoiceNumberSequence')),
  currency: z.string().length(3, t('features.timesheets.validation.currencyLength')),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t('features.timesheets.validation.validDate')),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t('features.timesheets.validation.validDate')),
  subject: z.string().trim().max(500),
  notes: z.string().trim().max(5000),
  lines: z.array(z.object({
    description: z.string().trim().min(1, t('features.timesheets.validation.required')).max(500),
    quantityMilli: z.number().int().positive(t('features.timesheets.validation.positiveQuantity')),
    unit: z.string().min(1),
    unitPriceMinor: z.number().int().min(0),
    vatRateBasisPoints: z.number().int().min(0).max(10_000),
    timeEntryIds: z.array(z.string())
  })).min(1, t('features.timesheets.validation.invoiceLineRequired'))
}).refine(value => value.dueDate >= value.issueDate, {
  path: ['dueDate'],
  message: t('features.timesheets.validation.dueDateOrder')
}))
const money = (minor: unknown, currency = props.data.settings.currency) => new Intl.NumberFormat(locale.value, { style: 'currency', currency }).format(Number(minor) / 100)
const dateTime = (value: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const quantityFormat: Intl.NumberFormatOptions = { minimumFractionDigits: 2, maximumFractionDigits: 3 }
const currencyFormat = computed<Intl.NumberFormatOptions>(() => ({ style: 'currency', currency: model.currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const percentageFormat: Intl.NumberFormatOptions = { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }
const updateQuantity = (line: typeof model.lines[number], value: number | null | undefined) => { line.quantityMilli = Math.round(Number(value ?? 0) * 1000) }
const updateUnitPrice = (line: typeof model.lines[number], value: number | null | undefined) => { line.unitPriceMinor = Math.round(Number(value ?? 0) * 100) }
const updateVatRate = (line: typeof model.lines[number], value: number | null | undefined) => { line.vatRateBasisPoints = Math.round(Number(value ?? 0) * 10_000) }
const lineAmount = (line: typeof model.lines[number]) => Math.round(line.quantityMilli * line.unitPriceMinor / 1000)
const subtotalMinor = computed(() => model.lines.reduce((sum, line) => sum + lineAmount(line), 0))
const vatMinor = computed(() => model.lines.reduce((sum, line) => sum + Math.round(lineAmount(line) * line.vatRateBasisPoints / 10_000), 0))
const totalMinor = computed(() => subtotalMinor.value + vatMinor.value)
const lastInvoiceNumber = computed(() => listing.items.value[0]?.number ?? '—')
const periodEntries = computed(() => props.data.invoiceableEntries.filter(entry => entry.date >= periodFrom.value && entry.date <= periodTo.value))
const clientOptions = computed(() => props.data.clients.map(client => {
  const entries = periodEntries.value.filter(entry => entry.client === client.name)
  return { ...client, amountMinor: entries.reduce((sum, entry) => sum + entry.amountMinor, 0), entries }
}).filter(client => client.entries.length))
const selectedClient = computed(() => props.data.clients.find(client => client.organizationId === model.clientOrganizationId))
const missingClientInvoiceDetails = computed(() => {
  const client = selectedClient.value
  if (!client) return []
  const missing = [
    !client.address.trim() && t('features.timesheets.admin.address'),
    !client.invoiceEmail?.trim() && t('features.timesheets.admin.invoiceEmail'),
    !client.contacts.length && t('features.timesheets.admin.contactPersons')
  ]
  return missing.filter((item): item is string => Boolean(item))
})
const selectedClientReady = computed(() => Boolean(selectedClient.value) && !missingClientInvoiceDetails.value.length)
const senderInvoiceDetailsComplete = computed(() => {
  const profile = props.data.organizationProfile
  return [profile.address, profile.registrationNumber, profile.vatNumber, profile.iban, profile.bic, profile.invoiceEmail]
    .every(value => Boolean(value?.trim()))
})
const clientEntries = computed(() => periodEntries.value.filter(entry => entry.client === selectedClient.value?.name))
const availableProjects = computed(() => props.data.projects.filter(project => project.clientOrganizationId === model.clientOrganizationId && clientEntries.value.some(entry => entry.project === project.name)))
const selectedEntries = computed(() => clientEntries.value.filter(entry => selectedProjectIds.value.includes(props.data.projects.find(project => project.name === entry.project && project.clientOrganizationId === model.clientOrganizationId)?.id ?? '')))
const reset = () => { formOpen.value = false; step.value = 1; source.value = ''; model.clientOrganizationId = ''; model.contactId = ''; selectedProjectIds.value = []; model.lines = [emptyLine()] }
const openWizard = async () => {
  if (!senderInvoiceDetailsComplete.value) {
    await navigateTo('/admin/timesheets/settings#sender-invoice-details')
    return
  }
  reset()
  model.number = (await api.getNextInvoiceNumber()).number
  formOpen.value = true
}
const chooseClient = (id: string) => { model.clientOrganizationId = id; model.contactId = ''; selectedProjectIds.value = []; const projects = props.data.projects.filter(project => project.clientOrganizationId === id); if (projects.length === 1) selectedProjectIds.value = [projects[0]!.id] }
const editSelectedClient = async () => {
  await navigateTo({
    path: '/admin/timesheets/clients',
    query: { edit: selectedClient.value?.organizationId }
  })
}
const groupEntries = (entries: InvoiceableEntryDto[]) => {
  const groups = new Map<string, InvoiceableEntryDto[]>()
  for (const entry of entries) {
    const label = detailLevel.value === 'DETAILED' ? `${entry.date} · ${entry.person} · ${entry.project} · ${entry.activity}${entry.note ? ` · ${entry.note}` : ''}` : groupBy.value === 'PERSON' ? entry.person : groupBy.value === 'ACTIVITY' ? entry.activity : groupBy.value === 'PERSON_ACTIVITY' ? `${entry.person} · ${entry.activity}` : entry.project
    const key = `${label}|${entry.hourlyRateMinor}`
    groups.set(key, [...(groups.get(key) ?? []), entry])
  }
  model.lines = [...groups.entries()].map(([key, rows]) => ({ description: key.split('|')[0]!, quantityMilli: Math.round(rows.reduce((sum, row) => sum + row.minutes, 0) * 1000 / 60), unit: 'hour', unitPriceMinor: rows[0]!.hourlyRateMinor, vatRateBasisPoints: props.data.settings.defaultVatRateBasisPoints, timeEntryIds: rows.map(row => row.entryId) }))
}
const next = () => { if (source.value === 'FREE' && step.value === 2) step.value = 5; else if (source.value === 'TIME' && step.value === 4) { groupEntries(selectedEntries.value); step.value = 5 } else step.value++ }
const back = () => { if (source.value === 'FREE' && step.value === 5) step.value = 2; else step.value-- }
const canContinue = computed(() => step.value === 1 ? Boolean(source.value) : step.value === 2 ? selectedClientReady.value : step.value === 3 ? selectedProjectIds.value.length > 0 : true)
const save = async () => { busy.value = true; try { await api.createInvoice({ ...model, contactId: model.contactId || null }); reset(); await props.refresh(); await listing.refresh(); toast.add({ title: t('features.timesheets.admin.invoiceCreated'), color: 'success' }) } catch (error) { toast.add({ title: t('features.timesheets.messages.saveError'), description: String(error), color: 'error' }) } finally { busy.value = false } }
const statusColor = (status: string) => status === 'PAID' ? 'success' : status === 'ISSUED' ? 'info' : status === 'VOID' ? 'error' : 'neutral'
defineExpose({
  canCreate: computed(() => senderInvoiceDetailsComplete.value),
  openCreate: openWizard,
  refreshList: () => listing.refresh(),
  showCreate: computed(() => !formOpen.value && Boolean(listing.pagination.value.total) && senderInvoiceDetailsComplete.value)
})
await listing.load()
</script>

<template>
  <section class="-mx-1 flex h-full min-h-0 flex-col gap-4 px-1" :class="formOpen ? 'overflow-y-auto' : 'overflow-hidden'">
    <TimesheetsAdminListToolbar v-model:search="listing.search.value" :filters="invoiceFilters" :filter-values="listing.filters" :sort-options="sortOptions" :sort-by="listing.sortBy.value" :sort-dir="listing.sortDir.value" @filter="listing.setFilter" @sort="listing.sortBy.value = $event" @toggle-direction="listing.toggleSortDir" />
    <TimesheetsAdminEmptyState v-if="!formOpen && !senderInvoiceDetailsComplete" icon="i-lucide-file-warning" :title="t('features.timesheets.admin.senderDetailsRequiredTitle')" :description="t('features.timesheets.admin.senderDetailsRequiredDescription')" :action-label="t('features.timesheets.admin.completeSenderDetails')" action-icon="i-lucide-settings-2" @action="openWizard" />
    <TimesheetsAdminEmptyState v-else-if="!formOpen && !listing.items.value.length && !listing.pending.value" icon="i-lucide-file-text" :title="t('features.timesheets.admin.noInvoicesTitle')" :description="t('features.timesheets.admin.noInvoicesDescription')" :action-label="t('features.timesheets.admin.createFirstInvoice')" @action="openWizard" />

    <UCard v-if="formOpen" class="scroll-mt-6">
      <template #header>
        <div class="flex items-center justify-between gap-4">
          <h2 class="font-semibold">{{ step === 5 ? t('features.timesheets.admin.newInvoiceFor', { name: selectedClient?.name }) : t('features.timesheets.admin.newInvoice') }}</h2>
          <span class="shrink-0 text-sm text-muted">{{ t('features.timesheets.admin.wizardStep', { step, total: 5 }) }}</span>
        </div>
      </template>

      <div v-if="step === 1" class="grid gap-3 md:grid-cols-2">
        <button class="invoice-source-card min-w-0 rounded-lg border border-default p-5 text-left hover:border-primary" @click="source = 'FREE'; next()"><UIcon name="i-lucide-file-pen-line" class="mb-3 size-6" /><h3 class="font-medium">{{ t('features.timesheets.admin.freeForm') }}</h3><p class="mt-1 text-sm text-muted">{{ t('features.timesheets.admin.freeFormDescription') }}</p></button>
        <button class="invoice-source-card min-w-0 rounded-lg border border-default p-5 text-left hover:border-primary" @click="source = 'TIME'; next()"><UIcon name="i-lucide-clock-3" class="mb-3 size-6" /><h3 class="font-medium">{{ t('features.timesheets.admin.approvedTime') }}</h3><p class="mt-1 text-sm text-muted">{{ t('features.timesheets.admin.approvedTimeDescription') }}</p></button>
      </div>
      <div v-else-if="step === 2" class="space-y-4">
        <div v-if="source === 'TIME'" class="grid gap-3 sm:grid-cols-2">
          <UFormField :label="t('features.timesheets.admin.periodFrom')"><UInput v-model="periodFrom" type="date" class="w-full" /></UFormField>
          <UFormField :label="t('features.timesheets.admin.periodTo')"><UInput v-model="periodTo" type="date" class="w-full" /></UFormField>
        </div>
        <h3 class="font-medium">{{ t('features.timesheets.admin.selectClient') }}</h3>
        <div class="grid gap-2">
          <button v-for="client in source === 'TIME' ? clientOptions : data.clients" :key="client.id" class="flex items-center justify-between rounded-lg border p-4 text-left" :class="model.clientOrganizationId === client.organizationId ? 'border-primary bg-primary/5' : 'border-default'" @click="chooseClient(client.organizationId)">
            <span>{{ client.name }}</span><span v-if="'amountMinor' in client" class="font-medium">{{ money(client.amountMinor) }}</span>
          </button>
          <p v-if="source === 'TIME' && !clientOptions.length" class="text-sm text-muted">{{ t('features.timesheets.admin.noInvoiceableTimeInPeriod') }}</p>
        </div>
        <div v-if="selectedClient && !selectedClientReady" class="rounded-lg border border-warning/50 bg-warning/10 p-4">
          <div class="flex items-start gap-3">
            <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-5 shrink-0 text-warning" />
            <div class="min-w-0 flex-1">
              <h4 class="font-medium">{{ t('features.timesheets.admin.clientDetailsRequiredTitle') }}</h4>
              <p class="mt-1 text-sm text-muted">{{ t('features.timesheets.admin.clientDetailsRequiredDescription', { fields: missingClientInvoiceDetails.join(', ') }) }}</p>
              <UButton class="mt-3" size="sm" variant="outline" icon="i-lucide-pencil" @click="editSelectedClient">
                {{ t('features.timesheets.admin.completeClientDetails') }}
              </UButton>
            </div>
          </div>
        </div>
      </div>
      <div v-else-if="step === 3" class="space-y-3"><h3 class="font-medium">{{ t('features.timesheets.admin.selectProjects') }}</h3><label v-for="project in availableProjects" :key="project.id" class="flex items-center gap-3 rounded-lg border border-default p-4"><input v-model="selectedProjectIds" type="checkbox" :value="project.id"><span class="flex-1">{{ project.name }}</span><span>{{ money(clientEntries.filter(entry => entry.project === project.name).reduce((sum, entry) => sum + entry.amountMinor, 0)) }}</span></label></div>
      <div v-else-if="step === 4" class="space-y-4"><UFormField :label="t('features.timesheets.admin.detailLevel')"><USelect v-model="detailLevel" :items="[{ label: t('features.timesheets.admin.summary'), value: 'SUMMARY' }, { label: t('features.timesheets.admin.detailed'), value: 'DETAILED' }]" value-key="value" class="w-full" /></UFormField><UFormField v-if="detailLevel === 'SUMMARY'" :label="t('features.timesheets.admin.groupBy')"><USelect v-model="groupBy" :items="[{ label: t('features.timesheets.admin.perProject'), value: 'PROJECT' }, { label: t('features.timesheets.admin.perPerson'), value: 'PERSON' }, { label: t('features.timesheets.admin.perActivity'), value: 'ACTIVITY' }, { label: t('features.timesheets.admin.perPersonActivity'), value: 'PERSON_ACTIVITY' }]" value-key="value" class="w-full" /></UFormField></div>

      <UForm v-else :state="model" :schema="invoiceSchema" class="invoice-workbench" @submit="save">
        <div class="invoice-meta-grid">
          <div class="invoice-meta-column">
            <UFormField name="number" :label="t('features.timesheets.admin.invoiceNumber')" required>
              <div class="flex items-center gap-3"><UInput v-model="model.number" class="min-w-0 flex-1" /><span class="hidden whitespace-nowrap text-xs text-muted sm:block">{{ t('features.timesheets.admin.lastUsedInvoiceNumber', { number: lastInvoiceNumber }) }}</span></div>
            </UFormField>
            <UFormField name="issueDate" :label="t('features.timesheets.admin.invoiceDate')"><UInput v-model="model.issueDate" type="date" class="w-full" /></UFormField>
            <UFormField name="dueDate" :label="t('features.timesheets.admin.dueDate')"><UInput v-model="model.dueDate" type="date" class="w-full" /></UFormField>
          </div>
          <div class="invoice-meta-column">
            <UFormField :label="t('features.timesheets.admin.client')"><UInput :model-value="selectedClient?.name" disabled class="w-full" /></UFormField>
            <UFormField name="contactId" :label="t('features.timesheets.admin.contact')"><USelect v-model="model.contactId" :items="selectedClient?.contacts.map(item => ({ label: `${item.name} · ${item.email}`, value: item.id })) ?? []" value-key="value" class="w-full" /></UFormField>
            <UFormField :label="t('features.timesheets.admin.currency')"><UInput v-model="model.currency" disabled class="w-full" /></UFormField>
          </div>
        </div>

        <UFormField name="subject" :label="t('features.timesheets.admin.subject')"><UInput v-model="model.subject" class="w-full" /></UFormField>

        <section class="invoice-ledger" :aria-label="t('features.timesheets.admin.invoiceDetails')">
          <div class="invoice-ledger-head" aria-hidden="true">
            <span>{{ t('features.timesheets.admin.description') }}</span><span>{{ t('features.timesheets.admin.quantity') }}</span><span>{{ t('features.timesheets.admin.unitPrice') }}</span><span>{{ t('features.timesheets.admin.amount') }}</span><span>{{ t('features.timesheets.admin.vat') }}</span><span />
          </div>
          <div v-for="(line, index) in model.lines" :key="index" class="invoice-line">
            <UFormField class="invoice-line-description" :name="`lines.${index}.description`" :label="t('features.timesheets.admin.description')"><UTextarea v-model="line.description" :rows="1" autoresize class="w-full" /></UFormField>
            <UFormField class="invoice-line-quantity" :name="`lines.${index}.quantityMilli`" :label="t('features.timesheets.admin.quantity')"><UInputNumber :model-value="line.quantityMilli / 1000" :min="0.001" :step="0.001" :format-options="quantityFormat" :increment="false" :decrement="false" :ui="{ base: 'text-right' }" class="w-full" @update:model-value="updateQuantity(line, $event)" /></UFormField>
            <UFormField class="invoice-line-price" :name="`lines.${index}.unitPriceMinor`" :label="t('features.timesheets.admin.unitPrice')"><UInputNumber :model-value="line.unitPriceMinor / 100" :min="0" :step="0.01" :format-options="currencyFormat" :increment="false" :decrement="false" :ui="{ base: 'text-right' }" class="w-full" @update:model-value="updateUnitPrice(line, $event)" /></UFormField>
            <div class="invoice-line-amount"><span class="invoice-mobile-label">{{ t('features.timesheets.admin.amount') }}</span><strong>{{ money(lineAmount(line), model.currency) }}</strong></div>
            <UFormField class="invoice-line-vat" :name="`lines.${index}.vatRateBasisPoints`" :label="t('features.timesheets.admin.vat')"><UInputNumber :model-value="line.vatRateBasisPoints / 10_000" :min="0" :max="1" :step="0.0001" :format-options="percentageFormat" :increment="false" :decrement="false" :ui="{ base: 'text-right' }" class="w-full" @update:model-value="updateVatRate(line, $event)" /></UFormField>
            <UButton v-if="source === 'FREE' || !line.timeEntryIds.length" type="button" class="invoice-line-remove self-start justify-self-end" style="transform: translateY(8px)" size="xs" color="neutral" variant="ghost" icon="i-lucide-trash-2" :aria-label="t('features.timesheets.admin.removeInvoiceLine', { number: index + 1 })" @click="model.lines.splice(index, 1)" />
          </div>
          <div class="invoice-ledger-footer">
            <div class="invoice-add-line"><UButton type="button" size="sm" variant="outline" icon="i-lucide-plus" @click="model.lines.push(emptyLine())">{{ t('features.timesheets.admin.addLine') }}</UButton></div>
            <dl class="invoice-totals">
              <div><dt>{{ t('features.timesheets.admin.subtotal') }}</dt><dd>{{ money(subtotalMinor, model.currency) }}</dd></div>
              <div><dt>{{ t('features.timesheets.admin.vat') }}</dt><dd>{{ money(vatMinor, model.currency) }}</dd></div>
              <div class="invoice-total"><dt>{{ t('features.timesheets.admin.totalPayable') }}</dt><dd>{{ money(totalMinor, model.currency) }}</dd></div>
            </dl>
          </div>
        </section>

        <UFormField name="notes" :label="t('features.timesheets.admin.notes')"><UTextarea v-model="model.notes" :rows="5" class="w-full" /></UFormField>
        <footer class="invoice-actions">
          <UButton type="button" color="neutral" variant="outline" @click="back">{{ t('features.timesheets.admin.previous') }}</UButton>
          <UButton type="submit" icon="i-lucide-file-check-2" :loading="busy">{{ t('features.timesheets.admin.createDraftInvoice') }}</UButton>
        </footer>
      </UForm>

      <div v-if="step < 5" class="mt-6 flex justify-between"><UButton color="neutral" variant="outline" @click="step === 1 ? reset() : back()">{{ t(step === 1 ? 'features.timesheets.cancel' : 'features.timesheets.admin.previous') }}</UButton><UButton v-if="step > 1" :disabled="!canContinue" @click="next">{{ t('features.timesheets.admin.next') }}</UButton></div>
    </UCard>

    <TimesheetsAdminPaginatedList v-if="!formOpen && listing.items.value.length" class="min-h-0 flex-1" :pagination="listing.pagination.value" :pending="listing.pending.value" :loading-next="listing.loadingNextPage.value" :loading-previous="listing.loadingPreviousPage.value" :has-next="listing.hasNextPage.value" :has-previous="listing.hasPreviousPage.value" @next="listing.loadNext" @previous="listing.loadPrevious" @page="listing.goToPage">
      <div class="grid gap-3">
    <UCard v-for="invoice in listing.items.value" :key="invoice.id" :class="invoice.isOverdue ? 'ring-1 ring-warning/60' : ''" class="transition-colors hover:ring-1 hover:ring-primary/50">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <NuxtLink :to="`/admin/timesheets/invoices/${invoice.id}`" class="group min-w-0 flex-1 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
          <div class="flex flex-wrap items-center gap-2"><p class="font-semibold">{{ invoice.number }} · {{ invoice.recipientName }}</p><UBadge :color="statusColor(invoice.status)" variant="subtle">{{ t(`features.timesheets.admin.invoiceStatus.${invoice.status.toLowerCase()}`) }}</UBadge><UBadge v-if="invoice.isOverdue" color="warning" variant="subtle">{{ t('features.timesheets.admin.overdueDays', { count: invoice.daysOverdue }) }}</UBadge></div>
          <p class="mt-1 text-sm text-muted">{{ t('features.timesheets.admin.dueDate') }} {{ invoice.dueDate }} · {{ money(invoice.totalMinor, invoice.currency) }} · {{ t('features.timesheets.admin.outstanding') }} {{ money(invoice.outstandingMinor, invoice.currency) }}</p>
          <p v-if="invoice.isOverdue" class="mt-1 text-xs text-warning">{{ t('features.timesheets.admin.reminderSummary', { count: invoice.reminderCount, date: invoice.lastReminderSentAt ? dateTime(invoice.lastReminderSentAt) : t('features.timesheets.admin.never') }) }}</p>
        </NuxtLink>
        <NuxtLink :to="`/admin/timesheets/invoices/${invoice.id}`" :aria-label="t('features.timesheets.admin.openInvoice', { number: invoice.number })" class="shrink-0 rounded focus-visible:outline-2 focus-visible:outline-primary"><UIcon name="i-lucide-chevron-right" class="size-5 text-muted" /></NuxtLink>
      </div>
    </UCard>
      </div>
    </TimesheetsAdminPaginatedList>
  </section>
</template>

<style scoped>
/* Hallmark · pre-emit critique: P4 H5 E4 S5 R5 V4
 * Hallmark · genre: modern-minimal · macrostructure: Workbench · tone: utilitarian · designed-as-app
 * contrast: pass (40–41) · tokens: pass (48) · responsive: pass (34, 49–57) · icons: pass (30)
 */
.invoice-workbench { display: grid; gap: 1.5rem; }
.invoice-source-card, .invoice-source-card p { white-space: normal !important; overflow-wrap: anywhere; }
.invoice-meta-grid { display: grid; gap: 1.5rem; padding-block-end: 1.5rem; border-block-end: 1px solid var(--timesheets-rule); }
.invoice-meta-column { display: grid; gap: 1rem; align-content: start; }
.invoice-ledger { overflow: clip; border: 1px solid var(--timesheets-rule); border-radius: var(--timesheets-radius); }
.invoice-ledger-head { display: none; }
.invoice-line { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0.75rem; padding: 1rem; border-block-end: 1px solid var(--timesheets-rule); }
.invoice-line-remove { grid-column: 2; justify-self: end; min-width: 2.75rem; min-height: 2.75rem; }
.invoice-line-amount { display: flex; flex-direction: column; gap: 0.5rem; justify-content: end; min-height: 2.75rem; }
.invoice-line-description { grid-column: 1 / -1; }
.invoice-line-amount { text-align: end; }
.invoice-mobile-label { font-size: 0.75rem; color: var(--ui-text-muted); }
.invoice-ledger-footer { display: grid; gap: 1.5rem; align-items: start; padding: 1rem; }
.invoice-add-line { width: fit-content; justify-self: start; }
.invoice-totals { display: grid; gap: 0.75rem; width: min(100%, 22rem); }
.invoice-totals > div { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2rem; }
.invoice-totals dd { width: 12ch; white-space: nowrap; font-variant-numeric: tabular-nums; text-align: end; }
.invoice-total { padding-block-start: 0.75rem; border-block-start: 1px solid var(--timesheets-rule); font-weight: 700; }
.invoice-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.75rem; padding-block-start: 1rem; border-block-start: 1px solid var(--timesheets-rule); }
@media (min-width: 75rem) {
  .invoice-meta-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: clamp(2rem, 6vw, 6rem); }
  .invoice-ledger-head, .invoice-line { grid-template-columns: minmax(10rem, 1fr) 6.5rem 8rem 7.5rem 7rem 1.5rem; }
  .invoice-ledger-head { display: grid; gap: 0.75rem; padding: 0.75rem 1rem; border-block-end: 1px solid var(--timesheets-rule); font-size: 0.75rem; color: var(--ui-text-muted); }
  .invoice-line { align-items: start; }
  .invoice-line-description { grid-column: 1; grid-row: 1; }
  .invoice-line-quantity { grid-column: 2; grid-row: 1; }
  .invoice-line-price { grid-column: 3; grid-row: 1; }
  .invoice-line-amount { grid-column: 4; grid-row: 1; min-height: 2rem; margin-block-start: 0.25rem; padding-block: 0; align-items: flex-end; justify-content: center; }
  .invoice-line-amount strong { line-height: 1.25rem; }
  .invoice-line-vat { grid-column: 5; grid-row: 1; }
  .invoice-line-remove { grid-column: 6; grid-row: 1; align-self: center; justify-self: end; width: 1.5rem; min-width: 1.5rem; min-height: 1.5rem; padding: 0; }
  .invoice-line :deep(label) { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .invoice-mobile-label { display: none; }
  .invoice-ledger-footer { grid-template-columns: minmax(0, 1fr) auto; }
}
@media (prefers-reduced-motion: reduce) { .invoice-workbench * { scroll-behavior: auto !important; } }
</style>
