<script setup lang="ts">
import type { AdminUserResponse } from '@nuxt-customer-portal/core/shared/types/index'
import { authClient } from '@nuxt-customer-portal/core/app/utils/auth-client'

const props = defineProps<{ user: AdminUserResponse | null }>()
const emit = defineEmits<{ success: [], error: [message: string] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()
const deleting = ref(false)

const deleteUser = async () => {
  if (!props.user) return
  try {
    deleting.value = true
    const { error } = await authClient.admin.removeUser({ userId: props.user.id })
    if (error) throw error
    toast.add({ title: t('common.success'), description: t('admin.user.delete.success'), color: 'success' })
    open.value = false
    emit('success')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : t('admin.user.delete.error')
    toast.add({ title: t('common.error'), description: message, color: 'error' })
    emit('error', message)
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="t('admin.user.delete.title')" :ui="{ footer: 'justify-end' }">
    <template #body>
      <div class="space-y-3">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ t('admin.user.delete.description', { name: user?.name || user?.email }) }}
        </p>
        <UAlert color="error" variant="soft" :description="t('admin.user.delete.warning')" />
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton variant="outline" :disabled="deleting" @click="open = false">{{ t('common.cancel') }}</UButton>
        <UButton color="error" :loading="deleting" @click="deleteUser">{{ t('admin.user.delete.confirm') }}</UButton>
      </div>
    </template>
  </UModal>
</template>
