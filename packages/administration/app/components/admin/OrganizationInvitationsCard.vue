<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type {
  ApiError,
  Invitation,
  OrganizationInvitationsResponse
} from '@nuxt-customer-portal/core/shared/types/index'

const props = defineProps<{
  organizationId: string
  invitations: OrganizationInvitationsResponse
  loading?: boolean
}>()

const emit = defineEmits<{
  refresh: []
}>()

const { hasPermission } = useUserStore()
const { t, locale } = useI18n()
const toast = useToast()
const isMobile = useBreakpoints({ mobile: 768 }).smaller('mobile')
const showInviteModal = ref(false)
const showResendModal = ref(false)
const selectedInvitation = ref<{ id: string; email: string; role: string } | null>(null)

const columns = computed<TableColumn<Invitation>[]>(() =>
  isMobile.value
    ? [
        { accessorKey: 'email', header: t('admin.organization.detail.invitations.email') },
        { accessorKey: 'role', header: t('admin.organization.detail.invitations.role') },
        { accessorKey: 'actions', header: '' }
      ]
    : [
        { accessorKey: 'email', header: t('admin.organization.detail.invitations.email') },
        { accessorKey: 'role', header: t('admin.organization.detail.invitations.role') },
        { accessorKey: 'status', header: t('admin.organization.detail.invitations.status') },
        { accessorKey: 'expiresAt', header: t('admin.organization.detail.invitations.expires') },
        { accessorKey: 'actions', header: t('admin.organization.detail.invitations.actions') }
      ]
)

const openResendModal = (invitation: Invitation) => {
  selectedInvitation.value = { id: invitation.id, email: invitation.email, role: invitation.role || 'member' }
  showResendModal.value = true
}

const handleResendInvitation = async () => {
  if (!selectedInvitation.value) {
    return
  }
  try {
    await $fetch(`/api/admin/organizations/${props.organizationId}/invitations/${selectedInvitation.value.id}/resend`, {
      method: 'POST'
    })
    emit('refresh')
    toast.add({
      title: t('common.success'),
      description: t('admin.organization.detail.invitations.resendSuccess'),
      color: 'success'
    })
  } catch (error) {
    const apiError = error as ApiError
    toast.add({
      title: t('common.error'),
      description: apiError.message || t('admin.organization.detail.errors.resendFailed'),
      color: 'error'
    })
  } finally {
    selectedInvitation.value = null
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <h2 class="text-xl font-semibold">
          {{ t('admin.organization.detail.invitations.title') }} ({{ invitations.length }})
        </h2>
        <UButton
          v-if="hasPermission('invitation', 'create')"
          icon="i-lucide-user-plus"
          variant="outline"
          class="w-full sm:w-auto"
          @click="showInviteModal = true"
        >
          {{ t('admin.organization.detail.invitations.inviteMember') }}
        </UButton>
      </div>
    </template>

    <div v-if="invitations.length === 0" class="py-8 text-center">
      <p class="text-gray-600 dark:text-gray-400">{{ t('admin.organization.detail.invitations.empty') }}</p>
    </div>
    <UTable v-else :data="invitations" :columns="columns" :loading="loading">
      <template #role-cell="{ row }">
        <UBadge color="primary" variant="soft">{{ row.original.role || 'member' }}</UBadge>
      </template>
      <template #status-cell="{ row }">
        <UBadge :color="row.original.status === 'pending' ? 'warning' : 'neutral'" variant="soft">
          {{ row.original.status }}
        </UBadge>
      </template>
      <template #expiresAt-cell="{ row }">
        <span class="text-sm text-gray-600 dark:text-gray-400">{{
          new Date(row.original.expiresAt).toLocaleDateString(locale)
        }}</span>
      </template>
      <template #actions-cell="{ row }">
        <div class="flex gap-2">
          <UButton
            v-if="hasPermission('invitation', 'resend')"
            icon="i-lucide-send"
            variant="ghost"
            size="sm"
            @click="openResendModal(row.original)"
          >
            {{ t('admin.organization.detail.invitations.resend') }}
          </UButton>
          <InvitationActions
            v-if="row.original.status === 'pending'"
            :endpoint="`/api/admin/organizations/${organizationId}/invitations/${row.original.id}`"
            :email="row.original.email"
            :role="row.original.role ?? null"
            :can-edit="hasPermission('invitation', 'create')"
            :can-revoke="hasPermission('invitation', 'cancel')"
            @refresh="emit('refresh')"
          />
        </div>
      </template>
    </UTable>

    <AdminInviteMemberModal
      v-if="showInviteModal"
      v-model:open="showInviteModal"
      :organization-id="organizationId"
      @success="emit('refresh')"
    />
    <ConfirmationModal
      v-if="showResendModal && selectedInvitation"
      v-model:open="showResendModal"
      title="admin.organization.detail.invitations.confirmResend.title"
      message="admin.organization.detail.invitations.confirmResend.message"
      :message-params="{ email: selectedInvitation.email, role: selectedInvitation.role }"
      confirm-text="admin.organization.detail.invitations.confirmResend.confirm"
      confirm-color="primary"
      @confirm="handleResendInvitation"
    />
  </UCard>
</template>
