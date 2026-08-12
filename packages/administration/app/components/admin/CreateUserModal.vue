<script setup lang="ts">
import { authClient } from '@nuxt-customer-portal/core/app/utils/auth-client'
import type { UserRole } from '@nuxt-customer-portal/core/shared/types/index'

const emit = defineEmits<{ success: [] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()
const creating = ref(false)
const state = reactive({ name: '', email: '', password: '', role: 'user' as UserRole })
const roles = computed(() => [
  { label: t('admin.user.roles.user'), value: 'user' },
  { label: t('admin.user.roles.admin'), value: 'admin' }
])
const valid = computed(() => state.name.trim() && state.email.includes('@') && state.password.length >= 8)

const createUser = async () => {
  if (!valid.value) return
  try {
    creating.value = true
    const { error } = await authClient.admin.createUser({
      name: state.name.trim(),
      email: state.email.trim().toLowerCase(),
      password: state.password,
      role: state.role
    })
    if (error) throw error
    toast.add({ title: t('common.success'), description: t('admin.user.create.success'), color: 'success' })
    Object.assign(state, { name: '', email: '', password: '', role: 'user' })
    open.value = false
    emit('success')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : t('admin.user.create.error')
    toast.add({ title: t('common.error'), description: message, color: 'error' })
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="t('admin.user.create.title')" :ui="{ footer: 'justify-end' }">
    <template #body>
      <div class="space-y-4">
        <UFormField :label="t('admin.user.create.name')" required><UInput v-model="state.name" class="w-full" /></UFormField>
        <UFormField :label="t('admin.user.create.email')" required><UInput v-model="state.email" type="email" class="w-full" /></UFormField>
        <UFormField :label="t('admin.user.create.password')" :hint="t('admin.user.create.passwordHint')" required><UInput v-model="state.password" type="password" class="w-full" /></UFormField>
        <UFormField :label="t('admin.user.list.role')" required><USelect v-model="state.role" :items="roles" class="w-full" /></UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton variant="outline" :disabled="creating" @click="open = false">{{ t('common.cancel') }}</UButton>
        <UButton :loading="creating" :disabled="!valid" @click="createUser">{{ t('admin.user.create.confirm') }}</UButton>
      </div>
    </template>
  </UModal>
</template>
