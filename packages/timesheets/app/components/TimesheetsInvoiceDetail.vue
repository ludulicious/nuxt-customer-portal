<script setup lang="ts">
import { z } from 'zod'
import type { ClientInvoiceDto, InvoiceDto, InvoiceHistoryDto } from '@nuxt-customer-portal/timesheets/shared/types/timesheet'
import { isKnownEmailProviderEvent } from '@nuxt-customer-portal/timesheets/shared/email-delivery-status'

const props = withDefaults(defineProps<{ invoice: InvoiceDto | ClientInvoiceDto, refresh: () => Promise<unknown>, mode?: 'admin' | 'client' }>(), { mode: 'admin' })
const isClient = computed(() => props.mode === 'client')
const { t, locale } = useI18n()
const api = useTimesheets()
const toast = useToast()
const busy = ref(false)
const refreshingEmailStatuses = ref(false)
const emailDeliveries = ref(props.invoice.emailDeliveries ?? [])
const paymentOpen = ref(false)
const editOpen = ref(false)
const emailOpen = ref(false)
const emailMode = ref<'issue' | 'resend' | 'reminder'>('issue')
const attachment = ref<File | null>(null)
const attachmentDeletion = ref<{ id: string, name: string } | null>(null)
const attachmentDeleteOpen = ref(false)
const statusConfirmation = ref<'VOID' | 'UNVOID' | null>(null)
const statusConfirmationOpen = ref(false)
const today = new Date().toISOString().slice(0, 10)
const payment = reactive({ paidOn: today, amount: props.invoice.outstandingMinor / 100, reference: '', note: '' })
const edit = reactive({ number: props.invoice.number, issueDate: props.invoice.issueDate, dueDate: props.invoice.dueDate, subject: props.invoice.subject ?? '', notes: props.invoice.notes ?? '' })
watch(() => props.invoice.emailDeliveries, deliveries => {
  emailDeliveries.value = deliveries ?? []
})
const paymentSchema = computed(() => z.object({
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t('features.timesheets.validation.validDate')),
  amount: z.number().positive(t('features.timesheets.validation.positiveAmount')).max(props.invoice.outstandingMinor / 100),
  reference: z.string().trim().max(200),
  note: z.string().trim().max(1000)
}))
const editSchema = computed(() => z.object({
  number: z.string().trim().min(1, t('features.timesheets.validation.required')).max(60).regex(/\d+$/, t('features.timesheets.validation.invoiceNumberSequence')),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t('features.timesheets.validation.validDate')),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t('features.timesheets.validation.validDate')),
  subject: z.string().trim().max(500),
  notes: z.string().trim().max(5000)
}).refine(value => value.dueDate >= value.issueDate, { path: ['dueDate'], message: t('features.timesheets.validation.dueDateOrder') }))
const money = (minor: number) => new Intl.NumberFormat(locale.value, { style: 'currency', currency: props.invoice.currency }).format(minor / 100)
const number = (value: number) => new Intl.NumberFormat(locale.value, { minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(value / 1000)
const percentage = (basisPoints: number) => new Intl.NumberFormat(locale.value, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(basisPoints / 100)
const addressLines = (value: string) => value
  .replace(/\s+(?=\d{4}\s?[A-Z]{2}\b)/g, '\n')
  .replace(/\b(B\.?V\.?|N\.?V\.?|V\.?O\.?F\.?)\s+(?=\S)/gi, '$1\n')
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(Boolean)
const noteLines = (value: string) => value
  .replace(/\s+(?=(?:IBAN|BIC):)/gi, '\n')
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(Boolean)
const date = (value: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`))
const dateTime = (value: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const statusColor = computed(() => props.invoice.status === 'PAID' ? 'success' : props.invoice.status === 'ISSUED' ? 'info' : props.invoice.status === 'VOID' ? 'error' : 'neutral')
const providerStatusColor = (status: string) => {
  if (['delivered', 'opened', 'clicked'].includes(status)) return 'success'
  if (['bounced', 'failed', 'suppressed', 'complained'].includes(status)) return 'error'
  if (status === 'delivery_delayed') return 'warning'
  return 'neutral'
}
const providerStatusLabel = (status: string) => isKnownEmailProviderEvent(status)
  ? t(`features.timesheets.admin.emailProviderStatus.${status}`)
  : status
const historyText = (entry: InvoiceHistoryDto) => {
  if (entry.action === 'PAYMENT_REGISTERED') return t('features.timesheets.admin.invoiceHistory.payment', { amount: money(entry.amountMinor ?? 0) })
  if (entry.action === 'ATTACHMENT_ADDED') return t('features.timesheets.admin.invoiceHistory.attachment', { name: entry.attachmentName })
  if (entry.action === 'ATTACHMENT_REMOVED') return t('features.timesheets.admin.invoiceHistory.attachmentRemoved', { name: entry.attachmentName })
  if (entry.action === 'EMAIL_SENT') return t('features.timesheets.admin.invoiceHistory.emailed', { email: entry.attachmentName })
  if (entry.action === 'REMINDER_SENT') return t('features.timesheets.admin.invoiceHistory.reminderSent', { email: entry.attachmentName })
  return t(`features.timesheets.admin.invoiceHistory.${entry.action.toLowerCase()}`)
}
const run = async (operation: () => Promise<unknown>, success: string) => {
  busy.value = true
  try {
    await operation()
    await props.refresh()
    toast.add({ title: success, color: 'success' })
    return true
  } catch (error) {
    toast.add({ title: t('features.timesheets.messages.saveError'), description: String(error), color: 'error' })
    return false
  } finally {
    busy.value = false
  }
}
const confirmStatusAction = async () => {
  const action = statusConfirmation.value
  if (!action) return
  await run(
    () => api.changeInvoiceStatus(props.invoice.id, action),
    t(action === 'VOID' ? 'features.timesheets.admin.invoiceVoided' : 'features.timesheets.admin.invoiceUnvoided')
  )
  statusConfirmation.value = null
}
const requestStatusAction = (action: 'VOID' | 'UNVOID') => {
  statusConfirmation.value = action
  statusConfirmationOpen.value = true
}
const openEmail = (mode: 'issue' | 'resend' | 'reminder') => {
  emailMode.value = mode
  emailOpen.value = true
}
const openEdit = () => {
  Object.assign(edit, { number: props.invoice.number, issueDate: props.invoice.issueDate, dueDate: props.invoice.dueDate, subject: props.invoice.subject ?? '', notes: props.invoice.notes ?? '' })
  editOpen.value = true
}
const saveEdit = async () => {
  await run(() => api.updateInvoice(props.invoice.id, { ...edit, subject: edit.subject || null, notes: edit.notes || null }), t('features.timesheets.admin.invoiceUpdated'))
  editOpen.value = false
}
const menuItems = computed(() => {
  if (props.invoice.status === 'VOID') {
    return [{ label: t('features.timesheets.admin.unvoid'), icon: 'i-lucide-rotate-ccw', onSelect: () => requestStatusAction('UNVOID') }]
  }

  const items = []
  if (props.invoice.status === 'DRAFT') {
    items.push({ label: t('features.timesheets.admin.editInvoice'), icon: 'i-lucide-pencil', onSelect: openEdit })
  }
  items.push({ label: t('features.timesheets.admin.void'), icon: 'i-lucide-ban', color: 'error' as const, onSelect: () => requestStatusAction('VOID') })
  return items
})
const savePayment = async () => {
  await run(() => api.registerInvoicePayment(props.invoice.id, { paidOn: payment.paidOn, amountMinor: Math.round(payment.amount * 100), reference: payment.reference || null, note: payment.note || null }), t('features.timesheets.admin.paymentRegistered'))
  paymentOpen.value = false
}
const selectAttachment = (event: Event) => {
  attachment.value = (event.target as HTMLInputElement).files?.[0] ?? null
}
const uploadAttachment = async () => {
  if (!attachment.value) return
  await run(() => api.addInvoiceAttachment(props.invoice.id, attachment.value!), t('features.timesheets.admin.attachmentAdded'))
  attachment.value = null
}
const requestAttachmentRemoval = (id: string, name: string) => {
  attachmentDeletion.value = { id, name }
  attachmentDeleteOpen.value = true
}
const removeAttachment = async () => {
  if (!attachmentDeletion.value) return
  await run(() => api.deleteInvoiceAttachment(props.invoice.id, attachmentDeletion.value!.id), t('features.timesheets.admin.attachmentRemoved'))
  attachmentDeletion.value = null
}
const printInvoice = () => {
  const base = isClient.value ? '/api/timesheets/client/invoices' : '/api/timesheets/admin/invoices'
  window.open(`${base}/${props.invoice.id}/pdf?locale=${encodeURIComponent(locale.value)}`, '_blank', 'noopener,noreferrer')
}
const downloadInvoice = () => {
  const base = isClient.value ? '/api/timesheets/client/invoices' : '/api/timesheets/admin/invoices'
  window.open(`${base}/${props.invoice.id}/pdf?locale=${encodeURIComponent(locale.value)}&download=1`, '_blank', 'noopener,noreferrer')
}
const togglePayment = () => {
  paymentOpen.value = !paymentOpen.value
}
const mobileMenuItems = computed(() => {
  const items = []
  if (!isClient.value && props.invoice.isOverdue) items.push({ label: t('features.timesheets.admin.sendReminder'), icon: 'i-lucide-bell-ring', onSelect: () => openEmail('reminder') })
  if (!isClient.value && props.invoice.status === 'DRAFT') items.push({ label: t('features.timesheets.admin.issueAndSend'), icon: 'i-lucide-send', onSelect: () => openEmail('issue') })
  if (!isClient.value && props.invoice.status === 'ISSUED' && !props.invoice.isOverdue) items.push({ label: t('features.timesheets.admin.resendInvoice'), icon: 'i-lucide-mail', onSelect: () => openEmail('resend') })
  if (!isClient.value && props.invoice.status === 'ISSUED') items.push({ label: t('features.timesheets.admin.registerPayment'), icon: 'i-lucide-circle-dollar-sign', onSelect: togglePayment })
  items.push(
    { label: t('features.timesheets.admin.print'), icon: 'i-lucide-printer', onSelect: printInvoice },
    { label: t('features.timesheets.clientInvoices.download'), icon: 'i-lucide-download', onSelect: downloadInvoice }
  )
  if (!isClient.value) items.push(...menuItems.value)
  return items
})
const attachmentUrl = (attachmentId: string) => isClient.value
  ? `/api/timesheets/client/invoices/${props.invoice.id}/attachments/${attachmentId}`
  : `/api/timesheets/admin/invoices/${props.invoice.id}/attachments/${attachmentId}`
const refreshEmailStatuses = async (forceRefresh = false) => {
  if (!emailDeliveries.value.some(delivery => delivery.providerMessageId)) return
  refreshingEmailStatuses.value = true
  try {
    const result = await api.refreshInvoiceEmailStatuses(props.invoice.id, forceRefresh)
    emailDeliveries.value = result.deliveries
    if (result.failures.length) toast.add({ title: t('features.timesheets.admin.emailStatusRefreshPartial'), description: t('features.timesheets.admin.emailStatusRefreshPartialDescription'), color: 'warning' })
    else if (forceRefresh) toast.add({ title: t('features.timesheets.admin.emailStatusRefreshed'), color: 'success' })
  } catch {
    toast.add({ title: t('features.timesheets.admin.emailStatusRefreshFailed'), description: t('features.timesheets.admin.emailStatusRefreshFailedDescription'), color: 'warning' })
  } finally {
    refreshingEmailStatuses.value = false
  }
}

onMounted(() => {
  if (!isClient.value) void refreshEmailStatuses()
})
</script>

<template>
  <div class="invoice-detail space-y-6">
    <header class="invoice-detail-header">
      <div class="min-w-0">
        <UButton :to="isClient ? '/timesheets/invoices' : '/admin/timesheets/invoices'" variant="link" color="neutral" icon="i-lucide-arrow-left" class="invoice-back-link mb-2 px-0">{{ t('features.timesheets.admin.backToInvoices') }}</UButton>
        <div class="invoice-title-line"><h1 class="text-2xl font-semibold text-highlighted">{{ t('features.timesheets.admin.invoiceTitle', { number: invoice.number }) }}</h1><div class="invoice-status-badges"><UBadge :color="statusColor" variant="subtle">{{ t(`features.timesheets.admin.invoiceStatus.${invoice.status.toLowerCase()}`) }}</UBadge><UBadge v-if="invoice.isOverdue" color="warning" variant="subtle">{{ t('features.timesheets.admin.overdueDays', { count: invoice.daysOverdue }) }}</UBadge></div></div>
      </div>
      <div class="invoice-detail-actions print:hidden">
        <UDropdownMenu class="invoice-actions-compact" :items="mobileMenuItems" :content="{ align: 'end' }"><UButton color="neutral" variant="outline" icon="i-lucide-ellipsis-vertical" :aria-label="t('features.timesheets.admin.moreActions')" /></UDropdownMenu>
        <UButton v-if="!isClient && invoice.isOverdue" class="invoice-actions-wide" color="warning" icon="i-lucide-bell-ring" @click="openEmail('reminder')">{{ t('features.timesheets.admin.sendReminder') }}</UButton>
        <UButton v-if="!isClient && invoice.status === 'DRAFT'" class="invoice-actions-wide" icon="i-lucide-send" :loading="busy" @click="openEmail('issue')">{{ t('features.timesheets.admin.issueAndSend') }}</UButton>
        <UButton v-if="!isClient && invoice.status === 'ISSUED' && !invoice.isOverdue" class="invoice-actions-wide" icon="i-lucide-mail" variant="outline" :loading="busy" @click="openEmail('resend')">{{ t('features.timesheets.admin.resendInvoice') }}</UButton>
        <UButton v-if="!isClient && invoice.status === 'ISSUED'" class="invoice-actions-wide" color="success" variant="outline" icon="i-lucide-circle-dollar-sign" @click="togglePayment">{{ t('features.timesheets.admin.registerPayment') }}</UButton>
        <UButton class="invoice-actions-wide" color="neutral" variant="outline" icon="i-lucide-printer" @click="printInvoice">{{ t('features.timesheets.admin.print') }}</UButton>
        <UButton class="invoice-actions-wide" color="neutral" variant="outline" icon="i-lucide-download" @click="downloadInvoice">{{ t('features.timesheets.clientInvoices.download') }}</UButton>
        <UDropdownMenu v-if="!isClient && ['DRAFT', 'ISSUED', 'VOID'].includes(invoice.status)" class="invoice-actions-wide" :items="menuItems" :content="{ align: 'end' }"><UButton color="neutral" variant="ghost" icon="i-lucide-ellipsis-vertical" :aria-label="t('features.timesheets.admin.moreActions')" /></UDropdownMenu>
      </div>
    </header>

    <TimesheetsInvoiceEmailModal v-if="!isClient" v-model:open="emailOpen" :invoice-id="invoice.id" :mode="emailMode" :refresh="refresh" />

    <UAlert v-if="!isClient && invoice.isOverdue" class="print:hidden" color="warning" icon="i-lucide-triangle-alert" :title="t('features.timesheets.admin.overdueAlertTitle', { count: invoice.daysOverdue })" variant="outline" >
      <template #description>
        <div class="space-y-2"><p>{{ t('features.timesheets.admin.overdueAlertDescription', { dueDate: date(invoice.dueDate), amount: money(invoice.outstandingMinor) }) }}</p><p>{{ t('features.timesheets.admin.reminderSummary', { count: invoice.reminderCount, date: invoice.lastReminderSentAt ? dateTime(invoice.lastReminderSentAt) : t('features.timesheets.admin.never') }) }}</p></div>
      </template>
    </UAlert>

    <UCard v-if="!isClient && editOpen" class="print:hidden">
      <template #header><div class="flex items-center justify-between gap-3"><h2 class="font-semibold">{{ t('features.timesheets.admin.editInvoice') }}</h2><UButton color="neutral" variant="ghost" icon="i-lucide-x" :aria-label="t('features.timesheets.cancel')" @click="editOpen = false" /></div></template>
      <UForm :state="edit" :schema="editSchema" class="grid gap-4" @submit="saveEdit"><UFormField name="number" :label="t('features.timesheets.admin.invoiceNumber')"><UInput v-model="edit.number" class="w-full" /></UFormField><div class="grid gap-3 sm:grid-cols-2"><UFormField name="issueDate" :label="t('features.timesheets.admin.invoiceDate')"><UInput v-model="edit.issueDate" type="date" class="w-full" /></UFormField><UFormField name="dueDate" :label="t('features.timesheets.admin.dueDate')"><UInput v-model="edit.dueDate" type="date" class="w-full" /></UFormField></div><UFormField name="subject" :label="t('features.timesheets.admin.subject')"><UInput v-model="edit.subject" class="w-full" /></UFormField><UFormField name="notes" :label="t('features.timesheets.admin.notes')"><UTextarea v-model="edit.notes" :rows="5" class="w-full" /></UFormField><div class="flex justify-end gap-2"><UButton type="button" color="neutral" variant="ghost" @click="editOpen = false">{{ t('features.timesheets.cancel') }}</UButton><UButton type="submit" icon="i-lucide-save" :loading="busy">{{ t('features.timesheets.save') }}</UButton></div></UForm>
    </UCard>

    <UCard v-if="!isClient && paymentOpen" class="print:hidden">
      <UForm :state="payment" :schema="paymentSchema" class="grid gap-3 md:grid-cols-2 xl:grid-cols-4" @submit="savePayment">
        <UFormField name="paidOn" :label="t('features.timesheets.admin.paidOn')"><UInput v-model="payment.paidOn" type="date" class="w-full" /></UFormField>
        <UFormField name="amount" :label="t('features.timesheets.admin.paymentAmount')"><UInputNumber v-model="payment.amount" :min="0.01" :max="invoice.outstandingMinor / 100" :step="0.01" :increment="false" :decrement="false" :ui="{ base: 'text-right' }" class="w-full" /></UFormField>
        <UFormField name="reference" :label="t('features.timesheets.admin.reference')"><UInput v-model="payment.reference" class="w-full" /></UFormField>
        <UButton type="submit" color="success" icon="i-lucide-check" :loading="busy" class="self-end">{{ t('features.timesheets.admin.registerPayment') }}</UButton>
      </UForm>
    </UCard>

    <article class="invoice-paper">
      <div class="invoice-paper-heading">
        <div class="invoice-brand"><img v-if="invoice.senderLogo" :src="invoice.senderLogo" :alt="invoice.senderName" class="invoice-logo"><p v-else class="invoice-wordmark">{{ invoice.senderName }}</p></div>
        <div class="text-right"><p class="text-xl font-semibold">{{ t('features.timesheets.admin.invoiceDocumentTitle') }}</p><p class="invoice-label mt-3">{{ t('features.timesheets.admin.from') }}</p><p class="font-medium">{{ invoice.senderName }}</p><address class="not-italic text-sm text-muted"><span v-for="(line, index) in addressLines(invoice.senderAddress)" :key="index" class="block">{{ line }}</span></address></div>
      </div>
      <div class="invoice-parties">
        <section><p class="invoice-label">{{ t('features.timesheets.admin.recipient') }}</p><p class="font-semibold">{{ invoice.recipientName }}</p><address class="not-italic text-sm"><span v-for="(line, index) in addressLines(invoice.recipientAddress)" :key="index" class="block">{{ line }}</span></address><p v-if="invoice.recipientContactName" class="mt-2 text-sm">{{ invoice.recipientContactName }} · {{ invoice.recipientEmail }}</p></section>
        <dl class="invoice-metadata"><div><dt>{{ t('features.timesheets.admin.invoiceNumber') }}</dt><dd>{{ invoice.number }}</dd></div><div><dt>{{ t('features.timesheets.admin.invoiceDate') }}</dt><dd>{{ date(invoice.issueDate) }}</dd></div><div><dt>{{ t('features.timesheets.admin.dueDate') }}</dt><dd>{{ date(invoice.dueDate) }}</dd></div></dl>
      </div>
      <div v-if="invoice.subject" class="invoice-subject"><span class="invoice-label">{{ t('features.timesheets.admin.subject') }}</span><p>{{ invoice.subject }}</p></div>
      <div class="invoice-table-wrap"><table class="invoice-table"><thead><tr><th>{{ t('features.timesheets.admin.description') }}</th><th>{{ t('features.timesheets.admin.quantity') }}</th><th>{{ t('features.timesheets.admin.unitPrice') }}</th><th>{{ t('features.timesheets.admin.vat') }}</th><th>{{ t('features.timesheets.admin.amount') }}</th></tr></thead><tbody><tr v-for="line in invoice.lines" :key="line.id"><td>{{ line.description }}</td><td>{{ number(line.quantityMilli) }}</td><td>{{ money(line.unitPriceMinor) }}</td><td>{{ percentage(line.vatRateBasisPoints) }}%</td><td>{{ money(line.amountMinor) }}</td></tr></tbody></table></div>
      <div class="invoice-summary"><dl><div><dt>{{ t('features.timesheets.admin.subtotal') }}</dt><dd>{{ money(invoice.subtotalMinor) }}</dd></div><div><dt>{{ t('features.timesheets.admin.vat') }}</dt><dd>{{ money(invoice.vatMinor) }}</dd></div><div v-if="invoice.paidMinor"><dt>{{ t('features.timesheets.admin.paid') }}</dt><dd>− {{ money(invoice.paidMinor) }}</dd></div><div class="invoice-summary-total"><dt>{{ t('features.timesheets.admin.totalPayable') }}</dt><dd>{{ money(invoice.outstandingMinor) }}</dd></div></dl></div>
      <section v-if="invoice.notes" class="invoice-notes"><h2 class="invoice-label">{{ t('features.timesheets.admin.notes') }}</h2><p class="text-sm"><span v-for="(line, index) in noteLines(invoice.notes)" :key="index" class="block">{{ line }}</span></p></section>
      <section class="invoice-attachments print:hidden">
        <div class="flex flex-wrap items-center justify-between gap-3"><h2 class="font-semibold">{{ t('features.timesheets.admin.attachments') }}</h2><div v-if="!isClient" class="flex flex-wrap items-center gap-2"><input type="file" class="max-w-64 text-sm" @change="selectAttachment"><UButton size="sm" variant="outline" icon="i-lucide-paperclip" :disabled="!attachment" :loading="busy" @click="uploadAttachment">{{ t('features.timesheets.admin.attachFile') }}</UButton></div></div>
        <div v-if="invoice.attachments?.length" class="mt-3 grid gap-2"><div v-for="file in invoice.attachments" :key="file.id" class="flex items-center gap-2 rounded-md border border-default p-3"><a :href="attachmentUrl(file.id)" class="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary">{{ file.fileName }}</a><span class="shrink-0 text-xs text-muted">{{ Math.ceil(file.size / 1024) }} KB</span><UButton v-if="!isClient" size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" :aria-label="t('features.timesheets.admin.removeAttachment')" @click="requestAttachmentRemoval(file.id, file.fileName)" /></div></div><p v-else class="mt-2 text-sm text-muted">{{ t('features.timesheets.admin.noAttachments') }}</p>
      </section>
    </article>

    <section v-if="!isClient" class="invoice-history print:hidden">
      <h2 class="text-xl font-semibold">{{ t('features.timesheets.admin.invoiceHistoryTitle') }}</h2>
      <ol class="mt-4 divide-y divide-default border-y border-default"><li v-for="entry in invoice.history" :key="entry.id" class="invoice-history-row"><div class="invoice-history-event"><span class="invoice-history-dot" /><div class="min-w-0"><p class="font-medium">{{ historyText(entry) }}</p><p class="mt-0.5 text-sm text-muted">{{ entry.actorName }}</p></div></div><time class="invoice-history-time">{{ dateTime(entry.createdAt) }}</time></li></ol>
    </section>
    <section v-if="!isClient && emailDeliveries.length" class="print:hidden">
      <div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="text-xl font-semibold">{{ t('features.timesheets.admin.emailDeliveryHistory') }}</h2><p class="mt-1 max-w-3xl text-sm text-muted">{{ t('features.timesheets.admin.emailTrackingExplanation') }}</p></div><UButton type="button" color="neutral" variant="outline" size="sm" icon="i-lucide-refresh-cw" :loading="refreshingEmailStatuses" @click="refreshEmailStatuses(true)">{{ t('features.timesheets.admin.refreshEmailStatus') }}</UButton></div>
      <div class="mt-3 divide-y divide-default border-y border-default">
        <div v-for="delivery in emailDeliveries" :key="delivery.id" class="flex items-start justify-between gap-4 py-3">
          <div><p class="font-medium">{{ delivery.recipientEmail }}<span v-if="delivery.ccEmails.length"> · CC {{ delivery.ccEmails.join(', ') }}</span></p><p class="text-sm text-muted"><UBadge v-if="delivery.purpose === 'REMINDER'" color="warning" variant="subtle" size="xs" class="mr-2">{{ t('features.timesheets.admin.paymentReminder') }}</UBadge>{{ delivery.subject }} · {{ delivery.actorName }}</p><p v-if="delivery.sentAt" class="text-xs text-muted">{{ t('features.timesheets.admin.emailSentAt', { date: dateTime(delivery.sentAt) }) }}</p><p v-if="delivery.providerStatusCheckedAt" class="text-xs text-muted">{{ t('features.timesheets.admin.emailStatusCheckedAt', { date: dateTime(delivery.providerStatusCheckedAt) }) }}</p><p v-if="delivery.errorMessage" class="text-sm text-error">{{ delivery.errorMessage }}</p></div>
          <div class="flex flex-wrap justify-end gap-2"><UBadge :color="delivery.status === 'SENT' ? 'success' : delivery.status === 'FAILED' ? 'error' : 'warning'" variant="subtle">{{ t(`features.timesheets.admin.emailDeliveryStatus.${delivery.status.toLowerCase()}`) }}</UBadge><UBadge v-if="delivery.providerLastEvent" :color="providerStatusColor(delivery.providerLastEvent)" variant="subtle">{{ providerStatusLabel(delivery.providerLastEvent) }}</UBadge></div>
        </div>
      </div>
    </section>
    <ConfirmationModal v-if="!isClient" v-model:open="attachmentDeleteOpen" :title="t('features.timesheets.admin.removeAttachment')" :message="t('features.timesheets.admin.removeAttachmentDescription', { name: attachmentDeletion?.name })" :confirm-text="t('features.timesheets.admin.removeAttachment')" :cancel-text="t('features.timesheets.cancel')" confirm-color="error" @confirm="removeAttachment" @cancel="attachmentDeletion = null" />
    <ConfirmationModal
      v-if="!isClient"
      v-model:open="statusConfirmationOpen"
      :title="t(statusConfirmation === 'VOID' ? 'features.timesheets.admin.voidInvoiceTitle' : 'features.timesheets.admin.unvoidInvoiceTitle')"
      :message="t(statusConfirmation === 'VOID' ? 'features.timesheets.admin.voidInvoiceDescription' : 'features.timesheets.admin.unvoidInvoiceDescription', { number: invoice.number })"
      :confirm-text="t(statusConfirmation === 'VOID' ? 'features.timesheets.admin.void' : 'features.timesheets.admin.unvoid')"
      :cancel-text="t('features.timesheets.cancel')"
      :confirm-color="statusConfirmation === 'VOID' ? 'error' : 'primary'"
      @confirm="confirmStatusAction"
      @cancel="statusConfirmation = null"
    />
  </div>
</template>

<style scoped>
/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4
 * Hallmark · macrostructure: Long Document · tone: professional · anchor hue: existing-primary
 */
.invoice-detail { container-type: inline-size; }
.invoice-back-link { min-height: auto; border: 0; border-radius: 0; background: transparent; box-shadow: none; letter-spacing: normal; text-transform: none; }
.invoice-back-link:hover { background: transparent; box-shadow: none; text-decoration: underline; text-underline-offset: 0.2em; }
.invoice-detail-header { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 1rem; }
.invoice-detail h1 { min-width: 0; overflow-wrap: anywhere; }
.invoice-title-line { display: grid; gap: 0.6rem; }
.invoice-status-badges { display: flex; min-width: 0; flex-wrap: wrap; gap: 0.5rem; }
.invoice-detail-actions { display: flex; width: auto; flex-wrap: wrap; justify-content: flex-end; gap: 0.5rem; }
.invoice-actions-compact { display: inline-flex; }
.invoice-actions-wide { display: none; }
.invoice-paper { padding: clamp(1.25rem, 4vw, 3rem); overflow: clip; border: 1px solid var(--timesheets-rule); border-radius: var(--timesheets-radius); background: var(--ui-bg); }
.invoice-paper-heading, .invoice-parties { display: grid; gap: 2rem; }
.invoice-wordmark { font-size: 1.25rem; font-weight: 700; color: var(--ui-primary); }
.invoice-brand { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 1rem; }
.invoice-logo { width: auto; max-width: 12rem; height: auto; max-height: 5rem; object-fit: contain; object-position: left top; }
.invoice-parties { margin-block: clamp(3rem, 8vw, 7rem) 2rem; }
.invoice-label { margin-block-end: 0.35rem; font-size: 0.75rem; color: var(--ui-text-muted); }
.invoice-metadata { display: grid; gap: 0.4rem; font-size: 0.875rem; }
.invoice-metadata div { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 1.5rem; }
.invoice-metadata dt { color: var(--ui-text-muted); }
.invoice-subject { display: grid; gap: 0.5rem; padding-block: 1rem; border-block: 1px solid var(--timesheets-rule); }
.invoice-table-wrap { margin-block-start: 2rem; overflow-x: auto; }
.invoice-table { width: 100%; min-width: 42rem; border-collapse: collapse; font-size: 0.875rem; }
.invoice-table th, .invoice-table td { padding: 0.75rem; border-block-end: 1px solid var(--timesheets-rule); text-align: right; }
.invoice-table th { white-space: nowrap; }
.invoice-table th:first-child, .invoice-table td:first-child { text-align: left; }
.invoice-summary { display: flex; justify-content: flex-end; padding-block: 1.5rem; }
.invoice-summary dl { display: grid; gap: 0.6rem; width: min(100%, 22rem); }
.invoice-summary dl > div { display: grid; grid-template-columns: minmax(0, 1fr) 12ch; gap: 2rem; }
.invoice-summary dd { font-variant-numeric: tabular-nums; text-align: right; }
.invoice-summary-total { padding-block-start: 0.75rem; border-block-start: 1px solid var(--timesheets-rule); font-weight: 700; }
.invoice-notes, .invoice-attachments { margin-block-start: 2rem; padding-block-start: 1rem; border-block-start: 1px solid var(--timesheets-rule); }
.invoice-history-row { display: grid; gap: 0.4rem 1.5rem; padding-block: 1rem; }
.invoice-history-event { display: flex; min-width: 0; align-items: flex-start; gap: 0.75rem; }
.invoice-history-dot { width: 0.5rem; height: 0.5rem; flex: none; margin-block-start: 0.45rem; border-radius: 50%; background: var(--ui-primary); }
.invoice-history-time { padding-inline-start: 1.25rem; font-size: 0.875rem; color: var(--ui-text-muted); }
@media (min-width: 48rem) { .invoice-title-line { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; } .invoice-paper-heading, .invoice-parties { grid-template-columns: minmax(0, 1fr) minmax(16rem, 0.65fr); } .invoice-parties > :last-child { align-self: end; } }
@container (min-width: 80rem) { .invoice-detail-header { display: flex; flex-direction: row; align-items: flex-end; justify-content: space-between; } .invoice-detail-header > :first-child { flex: 1; } .invoice-detail-actions { width: max-content; flex-wrap: nowrap; justify-content: flex-end; } .invoice-actions-compact { display: none; } .invoice-actions-wide { display: inline-flex; } }
@media (min-width: 40rem) { .invoice-history-row { grid-template-columns: minmax(0, 1fr) auto; align-items: center; } .invoice-history-time { padding-inline-start: 0; text-align: end; } }
@media print { .invoice-paper { border: 0; box-shadow: none; } }
</style>
