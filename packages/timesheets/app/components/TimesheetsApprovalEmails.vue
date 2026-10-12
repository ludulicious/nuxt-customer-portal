<script setup lang="ts">
import { z } from 'zod'
import type { DeepReadonly } from 'vue'
import type { ApprovalEmailDto, ApprovalEmailContextDto } from '@nuxt-customer-portal/timesheets/shared/types/timesheet'

const props = defineProps<{
  submissionId: string
  clientOrganizationId?: string
  emails: DeepReadonly<ApprovalEmailDto[]>
  pending: boolean
  refresh: () => Promise<unknown>
}>()
const { t, locale } = useI18n()
const timesheets = useTimesheets()
const toast = useToast()
const isOpen = ref(false)
const busy = ref(false)
const loading = ref(false)
const loadError = ref(false)
const context = ref<ApprovalEmailContextDto | null>(null)
const state = reactive({ message: '' })
const schema = z.object({ message: z.string().trim().max(5000) })
const requestId = ref('')
const history = computed(() =>
  props.emails.filter((email) =>
    props.clientOrganizationId
      ? email.kind === 'client-requested' && email.clientOrganizationId === props.clientOrganizationId
      : email.kind === 'internal-requested'
  )
)
const formatDate = (value: string) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const openResend = async () => {
  if (loading.value) {
    return
  }
  loading.value = true
  loadError.value = false
  try {
    context.value = await timesheets.approvalEmailContext(props.submissionId, props.clientOrganizationId)
    state.message = context.value.message
    requestId.value = crypto.randomUUID()
    isOpen.value = true
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
}
const resend = async () => {
  if (!context.value || busy.value) {
    return
  }
  busy.value = true
  try {
    const result = await timesheets.resendApprovalEmail(props.submissionId, {
      clientOrganizationId: props.clientOrganizationId,
      version: context.value.version,
      message: state.message,
      requestId: requestId.value,
      recipients: context.value.recipients.map(({ id, email }) => ({ id, email }))
    })
    toast.add({
      title: t(
        result.failed
          ? 'features.timesheets.approvalEmails.partialFailure'
          : result.sending
            ? 'features.timesheets.approvalEmails.sending'
            : 'features.timesheets.approvalEmails.sent'
      ),
      description: t('features.timesheets.approvalEmails.result', { sent: result.sent, failed: result.failed }),
      color: result.failed ? 'warning' : result.sending ? 'info' : 'success'
    })
    isOpen.value = false
    await props.refresh()
  } catch (error) {
    const response = error as { data?: { message?: string } }
    toast.add({
      title: t('features.timesheets.approvalEmails.sendError'),
      description: response.data?.message,
      color: 'error'
    })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="mt-4 space-y-3 border-t border-default pt-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h3 class="text-sm font-semibold">{{ t('features.timesheets.approvalEmails.title') }}</h3>
      <UButton
        v-if="pending"
        color="neutral"
        variant="outline"
        size="sm"
        icon="i-lucide-mail"
        :loading="loading"
        @click="openResend"
      >
        {{ t('features.timesheets.approvalEmails.resend') }}
      </UButton>
    </div>
    <UAlert v-if="loadError" color="error" :title="t('features.timesheets.approvalEmails.loadError')" />
    <p v-if="!history.length" class="text-sm text-muted">{{ t('features.timesheets.approvalEmails.empty') }}</p>
    <ol v-else class="space-y-2">
      <li v-for="email in history" :key="email.id" class="rounded-md border border-default p-3 text-sm">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="font-medium break-words">{{ email.recipientName }} · {{ email.recipientEmail }}</p>
            <time class="text-muted" :datetime="email.sentAt || email.createdAt">{{
              formatDate(email.sentAt || email.createdAt)
            }}</time>
          </div>
          <UBadge
            :color="email.status === 'SENT' ? 'success' : email.status === 'FAILED' ? 'error' : 'warning'"
            variant="subtle"
          >
            {{ t(`features.timesheets.approvalEmails.status.${email.status}`) }}
          </UBadge>
        </div>
        <details v-if="email.message" class="mt-2">
          <summary class="cursor-pointer text-muted">{{ t('features.timesheets.approvalEmails.message') }}</summary>
          <p class="mt-1 whitespace-pre-wrap break-words">{{ email.message }}</p>
        </details>
      </li>
    </ol>
    <p v-if="history.length" class="text-xs text-muted">{{ t('features.timesheets.approvalEmails.sentHelp') }}</p>
    <UModal
      v-if="isOpen"
      v-model:open="isOpen"
      :dismissible="!busy"
      :title="t('features.timesheets.approvalEmails.resend')"
    >
      <template #body>
        <UForm :state="state" :schema="schema" novalidate class="space-y-4" @submit="resend">
          <p class="text-sm text-muted">{{ t('features.timesheets.approvalEmails.currentHelp') }}</p>
          <div>
            <h4 class="text-sm font-semibold">{{ t('features.timesheets.approvalEmails.currentApprovers') }}</h4>
            <ul class="mt-2 space-y-1 text-sm">
              <li v-for="recipient in context?.recipients" :key="recipient.id" class="break-words">
                {{ recipient.name }} · {{ recipient.email }}
              </li>
            </ul>
          </div>
          <UAlert
            v-if="!context?.canResend"
            color="warning"
            :title="t('features.timesheets.approvalEmails.unavailable')"
          />
          <UFormField
            name="message"
            :label="t('features.timesheets.approvalEmails.message')"
            :description="t('features.timesheets.approvalEmails.messageHelp')"
          >
            <UTextarea v-model="state.message" :rows="5" class="w-full" :disabled="busy" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="outline" :disabled="busy" @click="isOpen = false">{{
              t('features.timesheets.cancel')
            }}</UButton>
            <UButton type="submit" icon="i-lucide-send" :loading="busy" :disabled="!context?.canResend">{{
              t('features.timesheets.approvalEmails.send')
            }}</UButton>
          </div>
        </UForm>
      </template>
    </UModal>
  </section>
</template>
