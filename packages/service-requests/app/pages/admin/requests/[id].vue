<script setup lang="ts">
import { z } from 'zod'
import type { ServiceRequest, ServiceRequestAssigneeDto, ServiceRequestQuoteCreateInput, ServiceRequestStatus } from '@nuxt-customer-portal/service-requests/shared/types/service-request'

const route = useRoute()
const { t } = useI18n()
const toast = useToast()
const { actions: commercialActions } = useServiceRequestCommercialActions()
const { uploadAttachment } = useServiceRequests()
const id = route.params.id as string
const request = ref<ServiceRequest | null>(null)
const assignees = ref<ServiceRequestAssigneeDto[]>([])
const busy = ref(false)
const comment = ref('')
const attachment = ref<File | null>(null)
const quoteOpen = ref(false)
const quote = reactive<ServiceRequestQuoteCreateInput>({
  currency: 'EUR', validUntil: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), notes: '',
  lines: [{ description: '', quantityMilli: 1000, unit: 'item', unitPriceMinor: 0, vatRateBasisPoints: 2100 }]
})
const admin = reactive({ status: 'NEW' as ServiceRequestStatus, assignedToId: null as string | null, internalNotes: '' })
const statuses: ServiceRequestStatus[] = ['NEW', 'EVALUATING', 'AWAITING_APPROVAL', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'DECLINED', 'CANCELLED']
const statusOptions = computed(() => statuses.map((value) => ({ label: t(`features.serviceRequests.status.${value.toLowerCase()}`), value })))
const assigneeOptions = computed(() => [{ label: '—', value: null }, ...assignees.value.map((item) => ({ label: `${item.name}${item.active ? '' : ' (inactive)'}`, value: item.id }))])
const quoteSchema = z.object({ currency: z.string().length(3), validUntil: z.string().min(1), notes: z.string().optional(), lines: z.array(z.object({ description: z.string().min(1), quantityMilli: z.number().positive(), unit: z.string().min(1), unitPriceMinor: z.number().min(0), vatRateBasisPoints: z.number().min(0).max(10000) })).min(1) })

const refresh = async () => {
  request.value = await $fetch<ServiceRequest>(`/api/service-requests/${id}`)
  assignees.value = await $fetch<ServiceRequestAssigneeDto[]>('/api/service-requests/admin/assignees', { query: { current: request.value.assignedToId || undefined } })
  admin.status = request.value.status
  admin.assignedToId = request.value.assignedToId
  admin.internalNotes = request.value.internalNotes || ''
}
await refresh()
useSeoMeta({ title: () => request.value?.title || t('features.serviceRequests.navigation.manageRequests') })

const run = async (action: () => Promise<unknown>, success: string) => {
  busy.value = true
  try {
    await action()
    await refresh()
    toast.add({ title: success, color: 'success' })
  } catch (error) {
    toast.add({ title: t('common.error'), description: String(error), color: 'error' })
  } finally {
    busy.value = false
  }
}
const saveAdmin = () => run(() => $fetch(`/api/service-requests/admin/${id}`, { method: 'PATCH', body: admin }), t('features.serviceRequests.messages.updateSuccess'))
const addComment = () => run(async () => {
  await $fetch(`/api/service-requests/${id}/comments`, { method: 'POST', body: { body: comment.value } })
  comment.value = ''
}, t('features.serviceRequests.messages.commentAdded'))
const createQuote = () => run(async () => {
  await $fetch(`/api/service-requests/admin/${id}/quotes`, { method: 'POST', body: quote })
  quoteOpen.value = false
}, t('features.serviceRequests.messages.quoteCreated'))
const addAttachment = () => run(async () => {
  if (attachment.value) {
    await uploadAttachment(id, attachment.value)
  }
  attachment.value = null
}, t('features.serviceRequests.messages.updateSuccess'))
const sendQuote = (quoteId: string) => run(() => $fetch(`/api/service-requests/admin/${id}/quotes/${quoteId}/send`, { method: 'POST' }), t('features.serviceRequests.messages.quoteSent'))
const runCommercialAction = (action: (request: ServiceRequest, quote: NonNullable<ServiceRequest['quotes']>[number]) => Promise<{ to?: string } | undefined>, item: NonNullable<ServiceRequest['quotes']>[number]) => run(async () => {
  const result = await action(request.value!, item)
  if (result?.to) {
    await navigateTo(result.to)
  }
}, t('features.serviceRequests.messages.updateSuccess'))
const money = (minor: number, currency: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(minor / 100)
</script>

<template>
  <div v-if="request" class="mx-auto grid max-w-[1440px] gap-4 p-4 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] lg:p-8">
    <main class="min-w-0 space-y-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div><UButton variant="link" icon="i-lucide-arrow-left" to="/admin/requests">{{ t('features.serviceRequests.actions.back') }}</UButton><h1 class="text-2xl font-bold">{{ request.title }}</h1><p class="text-sm text-muted">{{ request.clientName }}</p></div>
        <div class="flex gap-2"><StatusBadge :status="request.status" /><UBadge variant="soft">{{ request.priority }}</UBadge></div>
      </div>

      <UCard><template #header><h2 class="font-semibold">{{ t('features.serviceRequests.sections.details') }}</h2></template>
        <p class="whitespace-pre-wrap">{{ request.description }}</p>
        <dl class="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <div><dt class="text-muted">{{ t('features.serviceRequests.fields.contactName') }}</dt><dd>{{ request.contactName || '—' }}</dd></div>
          <div><dt class="text-muted">{{ t('features.serviceRequests.fields.contactEmail') }}</dt><dd>{{ request.contactEmail || '—' }}</dd></div>
          <div><dt class="text-muted">{{ t('features.serviceRequests.fields.requestedDate') }}</dt><dd>{{ request.requestedDate || '—' }}</dd></div>
          <div><dt class="text-muted">{{ t('features.serviceRequests.fields.serviceLocation') }}</dt><dd>{{ request.serviceLocation || '—' }}</dd></div>
        </dl>
      </UCard>

      <UCard><template #header><div class="flex justify-between"><h2 class="font-semibold">{{ t('features.serviceRequests.sections.quotes') }}</h2><UButton icon="i-lucide-plus" variant="outline" @click="quoteOpen = !quoteOpen">{{ t('features.serviceRequests.actions.createQuote') }}</UButton></div></template>
        <UForm v-if="quoteOpen" :state="quote" :schema="quoteSchema" class="mb-6 space-y-4" @submit="createQuote">
          <div class="grid gap-3 sm:grid-cols-2"><UFormField :label="t('features.serviceRequests.fields.currency')" name="currency"><UInput v-model="quote.currency" /></UFormField><UFormField :label="t('features.serviceRequests.fields.validUntil')" name="validUntil"><UInput v-model="quote.validUntil" type="date" /></UFormField></div>
          <div v-for="(line, index) in quote.lines" :key="index" class="grid gap-2 rounded-lg border border-default p-3 sm:grid-cols-5">
            <UFormField class="sm:col-span-2" :name="`lines.${index}.description`"><UInput v-model="line.description" placeholder="Description" /></UFormField>
            <UInput v-model.number="line.quantityMilli" type="number" /><UInput v-model.number="line.unitPriceMinor" type="number" /><UInput v-model.number="line.vatRateBasisPoints" type="number" />
            <UButton v-if="quote.lines.length > 1" icon="i-lucide-trash" color="error" variant="ghost" @click="quote.lines.splice(index, 1)" />
          </div>
          <div class="flex justify-between"><UButton variant="outline" icon="i-lucide-plus" @click="quote.lines.push({ description: '', quantityMilli: 1000, unit: 'item', unitPriceMinor: 0, vatRateBasisPoints: 2100 })">{{ t('features.serviceRequests.actions.addLine') }}</UButton><UButton type="submit" :loading="busy">{{ t('common.create') }}</UButton></div>
        </UForm>
        <div class="grid gap-3"><div v-for="item in request.quotes" :key="item.id" class="rounded-lg border border-default p-4"><div class="flex flex-wrap justify-between gap-2"><div><strong>{{ item.number }}</strong><p class="text-sm text-muted">v{{ item.version }} · {{ item.status }} · {{ item.validUntil }}</p></div><div class="text-right"><strong>{{ money(item.totalMinor, item.currency) }}</strong><div class="mt-2 flex gap-2"><UButton v-if="item.status === 'DRAFT'" size="xs" icon="i-lucide-send" @click="sendQuote(item.id)">{{ t('features.serviceRequests.actions.sendQuote') }}</UButton><UButton v-for="action in commercialActions.filter((candidate) => candidate.available(request!, item))" :key="action.id" size="xs" variant="outline" :icon="action.icon" @click="runCommercialAction(action.run, item)">{{ action.label }}</UButton></div></div></div></div></div>
      </UCard>

      <UCard><template #header><h2 class="font-semibold">{{ t('features.serviceRequests.sections.timeline') }}</h2></template>
        <div class="mb-4 flex gap-2"><UInput v-model="comment" class="flex-1" :placeholder="t('features.serviceRequests.placeholders.comment')" @keyup.enter="comment && addComment()" /><UButton :disabled="!comment.trim()" @click="addComment">{{ t('features.serviceRequests.actions.addComment') }}</UButton></div>
        <ol class="space-y-3"><li v-for="activity in request.activities" :key="activity.id" class="border-l-2 border-default pl-3 text-sm"><div class="font-medium">{{ activity.actorName }} · {{ activity.type }}</div><p v-if="activity.body" class="whitespace-pre-wrap">{{ activity.body }}</p><time class="text-xs text-muted">{{ new Date(activity.createdAt).toLocaleString() }}</time></li></ol>
      </UCard>
    </main>

    <aside class="space-y-4"><UCard><template #header><h2 class="font-semibold">{{ t('features.serviceRequests.actions.adminActions') }}</h2></template><div class="space-y-4"><UFormField :label="t('features.serviceRequests.fields.status')"><USelect v-model="admin.status" :items="statusOptions" class="w-full" /></UFormField><UFormField :label="t('features.serviceRequests.fields.assignedTo')"><USelect v-model="admin.assignedToId" :items="assigneeOptions" class="w-full" /></UFormField><UFormField :label="t('features.serviceRequests.fields.internalNotes')"><UTextarea v-model="admin.internalNotes" class="w-full" :rows="6" /></UFormField><UButton block :loading="busy" @click="saveAdmin">{{ t('features.serviceRequests.actions.saveChanges') }}</UButton></div></UCard>
      <UCard><template #header><h2 class="font-semibold">{{ t('features.serviceRequests.sections.attachments') }}</h2></template><div class="mb-3 flex gap-2"><input type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" @change="attachment = ($event.target as HTMLInputElement).files?.[0] || null" /><UButton size="xs" :disabled="!attachment" @click="addAttachment">{{ t('features.serviceRequests.actions.upload') }}</UButton></div><div class="grid gap-2"><a v-for="file in request.attachments" :key="file.id" class="text-sm text-primary hover:underline" :href="`/api/service-requests/${id}/attachments/${file.id}`">{{ file.fileName }}</a><span v-if="!request.attachments.length" class="text-sm text-muted">—</span></div></UCard>
    </aside>
  </div>
</template>
