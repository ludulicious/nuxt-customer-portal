<script setup lang="ts">
import type { ApiError, Invitation, OrganizationInvitationsResponse } from '@nuxt-customer-portal/core/shared/types/index'

const props = withDefaults(defineProps<{
  organizationId: string
  invitations: OrganizationInvitationsResponse
  loading?: boolean
  canManage?: boolean
}>(), {
  loading: false,
  canManage: false
})

const emit = defineEmits<{ refresh: [] }>()
const { t, locale } = useI18n()
const toast = useToast()
const showInviteModal = ref(false)
const busyInvitationId = ref<string | null>(null)

const resend = async (invitation: Invitation) => {
  try {
    busyInvitationId.value = invitation.id
    await $fetch(`/api/organizations/${props.organizationId}/invitations/${invitation.id}/resend`, { method: 'POST' })
    toast.add({ title: t('common.success'), description: t('organization.members.invitations.resendSuccess'), color: 'success' })
    emit('refresh')
  } catch (error) {
    const apiError = error as ApiError
    toast.add({ title: t('common.error'), description: apiError.message || t('organization.members.errors.resendFailed'), color: 'error' })
  } finally {
    busyInvitationId.value = null
  }
}

const cancel = async (invitation: Invitation) => {
  if (!confirm(t('organization.members.confirm.cancelInvitation'))) return
  try {
    busyInvitationId.value = invitation.id
    await $fetch(`/api/organizations/${props.organizationId}/invitations/${invitation.id}/delete`, { method: 'POST' })
    toast.add({ title: t('common.success'), description: t('organization.members.invitations.deleteSuccess'), color: 'success' })
    emit('refresh')
  } catch (error) {
    const apiError = error as ApiError
    toast.add({ title: t('common.error'), description: apiError.message || t('organization.members.errors.cancelFailed'), color: 'error' })
  } finally {
    busyInvitationId.value = null
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-xl font-semibold">{{ t('organization.members.invitations.title') }} ({{ invitations.length }})</h2>
        <UButton v-if="canManage" icon="i-lucide-user-plus" variant="outline" @click="showInviteModal = true">
          {{ t('organization.members.invitations.inviteButton') }}
        </UButton>
      </div>
    </template>

    <div v-if="loading" class="py-8 text-center text-muted">{{ t('organization.members.loading') }}</div>
    <div v-else-if="invitations.length === 0" class="py-8 text-center text-muted">{{ t('organization.members.invitations.empty') }}</div>
    <div v-else class="divide-y divide-default">
      <div v-for="invitation in invitations" :key="invitation.id" class="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
        <div>
          <p class="font-medium">{{ invitation.email }}</p>
          <p class="text-sm text-muted">{{ t('organization.members.invitations.expires') }}: {{ new Date(invitation.expiresAt).toLocaleDateString(locale) }}</p>
        </div>
        <div class="flex items-center gap-2">
          <UBadge color="warning" variant="soft">{{ invitation.role || 'member' }}</UBadge>
          <template v-if="canManage">
            <UButton icon="i-lucide-send" variant="ghost" size="sm" :loading="busyInvitationId === invitation.id" :aria-label="t('organization.members.invitations.resend')" @click="resend(invitation)" />
            <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="sm" :disabled="busyInvitationId !== null" :aria-label="t('organization.members.invitations.delete')" @click="cancel(invitation)" />
          </template>
        </div>
      </div>
    </div>

    <OrganizationInviteMemberModal v-if="showInviteModal" v-model:open="showInviteModal" :organization-id="organizationId" @success="emit('refresh')" />
  </UCard>
</template>
