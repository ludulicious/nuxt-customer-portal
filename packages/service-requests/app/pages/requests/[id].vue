<script setup lang="ts">
import type {
  ServiceRequestUpdateInput,
  ServiceRequestWithRelations
} from '@nuxt-customer-portal/service-requests/shared/types/service-request'

const route = useRoute()
const { t } = useI18n()
const requestId = route.params.id as string

const { getRequest, updateRequest, deleteRequest, addComment, decideQuote, uploadAttachment } = useServiceRequests()
const { currentUser } = usePortalSession()
const toast = useToast()

const request = ref<ServiceRequestWithRelations | null>(null)
const loading = ref(true)
const updating = ref(false)
const showEditModal = ref(false)
const comment = ref('')
const attachment = ref<File | null>(null)

useSeoMeta({
  title: () => request.value?.title || t('features.serviceRequests.title')
})

const canEdit = computed(() => {
  return request.value?.createdById === currentUser.value?.id && request.value?.status === 'NEW'
})

const canDelete = computed(() => {
  return request.value?.createdById === currentUser.value?.id && request.value?.status === 'NEW'
})

const backRoute = computed(() => {
  if (route.query.from !== 'list') {
    return '/requests'
  }
  const query: Record<string, string> = {}
  if (route.query.search != null && route.query.search !== '') {
    query.search = String(route.query.search)
  }
  if (route.query.status != null && route.query.status !== '') {
    query.status = String(route.query.status)
  }
  if (route.query.priority != null && route.query.priority !== '') {
    query.priority = String(route.query.priority)
  }
  if (route.query.category != null && route.query.category !== '') {
    query.category = String(route.query.category)
  }
  if (route.query.sortBy != null && route.query.sortBy !== '') {
    query.sortBy = String(route.query.sortBy)
  }
  if (route.query.sortDir != null && route.query.sortDir !== '') {
    query.sortDir = String(route.query.sortDir)
  }
  if (route.query.page != null && route.query.page !== '') {
    query.page = String(route.query.page)
  }
  return { path: '/requests', query }
})

onMounted(async () => {
  try {
    request.value = await getRequest(requestId)
  } catch {
    toast.add({
      title: t('common.error'),
      description: t('features.serviceRequests.messages.fetchError'),
      color: 'error'
    })
  } finally {
    loading.value = false
  }
})

const handleUpdate = async (data: ServiceRequestUpdateInput) => {
  updating.value = true
  try {
    request.value = await updateRequest(requestId, data)
    showEditModal.value = false
    toast.add({
      title: t('common.success'),
      description: t('features.serviceRequests.messages.updateSuccess')
    })
  } catch {
    toast.add({
      title: t('common.error'),
      description: t('features.serviceRequests.messages.updateError'),
      color: 'error'
    })
  } finally {
    updating.value = false
  }
}

const refresh = async () => {
  request.value = await getRequest(requestId)
}
const handleComment = async () => {
  if (!comment.value.trim()) {
		return
}
  await addComment(requestId, comment.value)
  comment.value = ''
  await refresh()
  toast.add({ title: t('features.serviceRequests.messages.commentAdded'), color: 'success' })
}
const handleDecision = async (quoteId: string, action: 'accept' | 'decline') => {
  await decideQuote(requestId, quoteId, action)
  await refresh()
  toast.add({ title: t('features.serviceRequests.messages.quoteDecided'), color: 'success' })
}
const handleAttachment = async () => {
  if (!attachment.value) {
return
}
  await uploadAttachment(requestId, attachment.value)
  attachment.value = null
  await refresh()
}
const money = (minor: number, currency: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(minor / 100)

const handleDelete = async () => {
  if (!confirm('Are you sure you want to delete this request?')) {
    return
  }

  try {
    await deleteRequest(requestId)
    toast.add({
      title: t('common.success'),
      description: t('features.serviceRequests.messages.deleteSuccess')
    })
    navigateTo(backRoute.value)
  } catch {
    toast.add({
      title: t('common.error'),
      description: t('features.serviceRequests.messages.deleteError'),
      color: 'error'
    })
  }
}
const handleCancel = async () => {
  await $fetch(`/api/service-requests/${requestId}/cancel`, { method: 'POST' })
  await refresh()
  toast.add({ title: t('features.serviceRequests.messages.updateSuccess'), color: 'success' })
}
</script>

<template>
  <div class="container mx-auto py-8 max-w-4xl">
    <div class="mb-4">
      <UButton icon="i-lucide-arrow-left" variant="ghost" size="sm" :to="backRoute">
        {{ t('features.serviceRequests.actions.back') }}
      </UButton>
    </div>

    <div v-if="loading">
      <USkeleton class="h-32 w-full mb-4" />
      <USkeleton class="h-64 w-full" />
    </div>

    <div v-else-if="!request" class="text-center py-8">
      <p>{{ t('features.serviceRequests.messages.notFound') }}</p>
      <UButton :to="backRoute">{{ t('features.serviceRequests.actions.back') }}</UButton>
    </div>

    <div v-else>
      <CustomerRequestDetail
        :request-id="request.id"
        :can-edit="canEdit"
        :can-delete="canDelete"
        @edit="showEditModal = true"
        @delete="handleDelete"
      />
      <div v-if="!['COMPLETED', 'DECLINED', 'CANCELLED'].includes(request.status)" class="mt-4 flex justify-end"><UButton color="error" variant="outline" @click="handleCancel">{{ t('features.serviceRequests.actions.cancelRequest') }}</UButton></div>

      <div class="mt-6 space-y-6">
        <UCard v-if="request.quotes?.length">
          <template #header><h2 class="font-semibold">{{ t('features.serviceRequests.sections.quotes') }}</h2></template>
          <div class="grid gap-3"><div v-for="quote in request.quotes" :key="quote.id" class="rounded-lg border border-default p-4"><div class="flex flex-wrap justify-between gap-3"><div><strong>{{ quote.number }}</strong><p class="text-sm text-muted">{{ quote.status }} · {{ quote.validUntil }}</p></div><strong>{{ money(quote.totalMinor, quote.currency) }}</strong></div><div v-if="quote.status === 'SENT'" class="mt-3 flex justify-end gap-2"><UButton variant="outline" color="error" @click="handleDecision(quote.id, 'decline')">{{ t('features.serviceRequests.actions.declineQuote') }}</UButton><UButton @click="handleDecision(quote.id, 'accept')">{{ t('features.serviceRequests.actions.acceptQuote') }}</UButton></div></div></div>
        </UCard>
        <UCard><template #header><h2 class="font-semibold">{{ t('features.serviceRequests.sections.timeline') }}</h2></template><div class="mb-4 flex gap-2"><UInput v-model="comment" class="flex-1" :placeholder="t('features.serviceRequests.placeholders.comment')" @keyup.enter="handleComment" /><UButton :disabled="!comment.trim()" @click="handleComment">{{ t('features.serviceRequests.actions.addComment') }}</UButton></div><ol class="space-y-3"><li v-for="activity in request.activities" :key="activity.id" class="border-l-2 border-default pl-3 text-sm"><strong>{{ activity.actorName }}</strong><p v-if="activity.body">{{ activity.body }}</p><time class="text-xs text-muted">{{ new Date(activity.createdAt).toLocaleString() }}</time></li></ol></UCard>
        <UCard><template #header><h2 class="font-semibold">{{ t('features.serviceRequests.sections.attachments') }}</h2></template><div class="mb-4 flex gap-2"><input type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" @change="attachment = ($event.target as HTMLInputElement).files?.[0] || null" /><UButton :disabled="!attachment" @click="handleAttachment">{{ t('features.serviceRequests.actions.upload') }}</UButton></div><div class="grid gap-2"><a v-for="file in request.attachments" :key="file.id" class="text-primary hover:underline" :href="`/api/service-requests/${requestId}/attachments/${file.id}`">{{ file.fileName }}</a></div></UCard>
      </div>

      <!-- Edit Modal -->
      <UModal v-model="showEditModal">
        <UCard>
          <template #header>
            <h2 class="text-xl font-bold">{{ t('features.serviceRequests.edit') }}</h2>
          </template>

          <CustomerRequestForm
            :initial-data="request"
            :loading="updating"
            @submit="handleUpdate"
            @cancel="showEditModal = false"
          />
        </UCard>
      </UModal>
    </div>
  </div>
</template>
