<script setup lang="ts">
import type { AdminUserResponse, OrganizationMemberWithUser } from '@nuxt-customer-portal/core/shared/types/index'

const props = defineProps<{
  organizationId: string
  members: OrganizationMemberWithUser[]
  loading?: boolean
  canRemove?: boolean
  canLink?: boolean
}>()

const emit = defineEmits<{
  refresh: []
}>()

const { t } = useI18n()
const { currentUser } = storeToRefs(useUserStore())
const toast = useToast()
const selectedMember = ref<OrganizationMemberWithUser | null>(null)
const showRemoveModal = ref(false)
const showLinkModal = ref(false)
const removing = ref(false)
const users = computed<AdminUserResponse[]>(() =>
  props.members.map((member) => ({
    ...member.user,
    name: member.user.name || '',
    image: member.user.image || undefined
  }))
)
const removableUserIds = computed(() =>
  props.canRemove
    ? props.members.filter((member) => member.userId !== currentUser.value?.id).map((member) => member.userId)
    : []
)

const requestRemove = (user: AdminUserResponse) => {
  selectedMember.value = props.members.find((member) => member.userId === user.id) || null
  showRemoveModal.value = selectedMember.value !== null
}

const removeMember = async () => {
  if (!selectedMember.value) {
    return
  }
  try {
    removing.value = true
    await $fetch(`/api/admin/organizations/${props.organizationId}/members/${selectedMember.value.id}`, {
      method: 'DELETE'
    })
    toast.add({
      title: t('common.success'),
      description: t('admin.organization.detail.members.removeSuccess'),
      color: 'success'
    })
    emit('refresh')
  } catch (error) {
    const message = error instanceof Error ? error.message : t('admin.organization.detail.members.removeFailed')
    toast.add({ title: t('common.error'), description: message, color: 'error' })
  } finally {
    removing.value = false
    selectedMember.value = null
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-xl font-semibold">{{ t('admin.organization.detail.members.title') }} ({{ members.length }})</h2>
        <UButton
          v-if="canLink"
          icon="i-lucide-user-plus"
          color="primary"
          variant="outline"
          size="sm"
          @click="showLinkModal = true"
        >
          {{ t('admin.organization.detail.members.link.action') }}
        </UButton>
      </div>
    </template>

    <AdminUsersTable
      :users="users"
      :loading="loading"
      :removable-user-ids="removableUserIds"
      @refresh="emit('refresh')"
      @remove="requestRemove"
    />

    <ConfirmationModal
      v-if="showRemoveModal && selectedMember"
      v-model:open="showRemoveModal"
      title="admin.organization.detail.members.confirmRemove.title"
      message="admin.organization.detail.members.confirmRemove.message"
      :message-params="{ name: selectedMember.user.name || selectedMember.user.email }"
      confirm-text="admin.organization.detail.members.confirmRemove.confirm"
      confirm-color="error"
      @confirm="removeMember"
    />

    <AdminLinkOrganizationMemberModal
      v-if="canLink"
      v-model:open="showLinkModal"
      :organization-id="organizationId"
      :member-user-ids="members.map((member) => member.userId)"
      @linked="emit('refresh')"
    />
  </UCard>
</template>
