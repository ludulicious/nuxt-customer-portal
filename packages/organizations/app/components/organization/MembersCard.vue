<script setup lang="ts">
import type { OrganizationMemberWithUser } from '@nuxt-customer-portal/core/shared/types/index'

const props = withDefaults(
  defineProps<{
    organizationId: string
    members: OrganizationMemberWithUser[]
    loading?: boolean
    canManage?: boolean
  }>(),
  {
    loading: false,
    canManage: false
  }
)

const emit = defineEmits<{ refresh: [] }>()
const { t } = useI18n()
const { currentUser } = storeToRefs(useUserStore())
const { removeMember } = useOrganization()
const toast = useToast()
const selectedMember = ref<OrganizationMemberWithUser | null>(null)
const showRemoveModal = ref(false)
const removing = ref(false)

const requestRemove = (member: OrganizationMemberWithUser) => {
  selectedMember.value = member
  showRemoveModal.value = true
}

const handleRemove = async () => {
  if (!selectedMember.value) {
    return
  }
  try {
    removing.value = true
    const result = await removeMember(selectedMember.value.user.email, props.organizationId)
    if (result.error) {
      throw result.error
    }
    toast.add({ title: t('common.success'), description: t('organization.members.removeSuccess'), color: 'success' })
    emit('refresh')
  } catch (error) {
    const message = error instanceof Error ? error.message : t('organization.members.errors.removeFailed')
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
      <h2 class="text-xl font-semibold">{{ t('organization.members.title') }} ({{ members.length }})</h2>
    </template>

    <div v-if="loading" class="py-8 text-center text-muted">{{ t('organization.members.loading') }}</div>
    <div v-else-if="members.length === 0" class="py-8 text-center text-muted">
      {{ t('organization.members.empty') }}
    </div>
    <div v-else class="divide-y divide-default">
      <div
        v-for="member in members"
        :key="member.id"
        class="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
      >
        <div class="flex min-w-0 items-center gap-3">
          <UAvatar :src="member.user.image || undefined" :alt="member.user.name || member.user.email" size="md" />
          <div class="min-w-0">
            <p class="truncate font-medium">{{ member.user.name || member.user.email }}</p>
            <p class="truncate text-sm text-muted">{{ member.user.email }}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <UBadge
            :color="member.role === 'owner' ? 'primary' : member.role === 'admin' ? 'info' : 'neutral'"
            variant="soft"
          >
            {{ t(`organization.members.roles.${Array.isArray(member.role) ? member.role[0] : member.role}`) }}
          </UBadge>
          <UButton
            v-if="canManage && member.userId !== currentUser?.id && member.role !== 'owner'"
            icon="i-lucide-user-minus"
            color="error"
            variant="ghost"
            size="sm"
            :aria-label="t('organization.members.remove')"
            @click="requestRemove(member)"
          />
        </div>
      </div>
    </div>

    <ConfirmationModal
      v-if="showRemoveModal && selectedMember"
      v-model:open="showRemoveModal"
      title="organization.members.confirmRemove.title"
      message="organization.members.confirmRemove.message"
      :message-params="{ name: selectedMember.user.name || selectedMember.user.email }"
      confirm-text="organization.members.confirmRemove.confirm"
      confirm-color="error"
      :loading="removing"
      @confirm="handleRemove"
    />
  </UCard>
</template>
