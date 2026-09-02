<script setup lang="ts">
import { invitationRoleSchema, type InvitationRole } from '@nuxt-customer-portal/core/shared/invitation-validation'

const props = defineProps<{
  endpoint: string
  email: string
  role: string | null
  canEdit?: boolean
  canRevoke?: boolean
}>()
const emit = defineEmits<{ refresh: [] }>()
const { t } = useI18n()
const api = useInvitationManagement()
const toast = useToast()
const editing = ref(false)
const revoking = ref(false)
const busy = ref(false)
const currentRole = (): InvitationRole => (props.role === 'admin' || props.role === 'owner' ? props.role : 'member')
const state = reactive({ role: currentRole() })
const openEditor = () => {
  state.role = currentRole()
  editing.value = true
}
const save = async () => {
  busy.value = true
  try {
    await api.changeRole(props.endpoint, state.role)
    editing.value = false
    toast.add({ title: t('invitationManagement.updated'), color: 'success' })
    emit('refresh')
  } catch {
    toast.add({ title: t('invitationManagement.failed'), color: 'error' })
  } finally {
    busy.value = false
  }
}
const revoke = async () => {
  busy.value = true
  try {
    await api.revoke(props.endpoint)
    toast.add({ title: t('invitationManagement.revoked'), color: 'success' })
    emit('refresh')
  } catch {
    toast.add({ title: t('invitationManagement.failed'), color: 'error' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex items-center gap-1" @click.stop @keydown.stop>
    <UButton
      v-if="canEdit"
      icon="i-lucide-pencil"
      color="neutral"
      variant="ghost"
      size="sm"
      :disabled="busy"
      :aria-label="t('invitationManagement.edit')"
      @click="openEditor"
    />
    <UButton
      v-if="canRevoke"
      icon="i-lucide-x"
      color="error"
      variant="ghost"
      size="sm"
      :disabled="busy"
      :aria-label="t('invitationManagement.revoke')"
      @click="revoking = true"
    />
    <UModal v-model:open="editing" :title="t('invitationManagement.edit')">
      <template #body>
        <UForm :state="state" :schema="invitationRoleSchema" novalidate class="space-y-4" @submit="save">
          <p>{{ email }}</p>
          <UFormField name="role" :label="t('invitationManagement.role')" required>
            <USelect v-model="state.role" :items="['member', 'admin', 'owner']" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="outline" @click="editing = false">{{ t('common.cancel') }}</UButton>
            <UButton type="submit" :loading="busy">{{ t('invitationManagement.save') }}</UButton>
          </div>
        </UForm>
      </template>
    </UModal>
    <ConfirmationModal
      v-model:open="revoking"
      title="invitationManagement.revoke"
      message="invitationManagement.confirmRevoke"
      :message-params="{ email }"
      confirm-text="invitationManagement.revoke"
      confirm-color="error"
      @confirm="revoke"
    />
  </div>
</template>
