<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { authClient } from '@nuxt-customer-portal/core/app/utils/auth-client'
import type { UserRole } from '@nuxt-customer-portal/core/shared/types/index'

const emit = defineEmits<{ success: [] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()
const creating = ref(false)
const state = reactive({ name: '', email: '', password: '', role: 'user' as UserRole })
const schema = computed(() =>
  z.object({
    name: z.string().trim().min(1, t('admin.user.create.nameRequired')).max(255, t('admin.user.create.nameMaxLength')),
    email: z.email(t('admin.user.create.emailInvalid')).transform((value) => value.trim().toLowerCase()),
    password: z.string().min(8, t('admin.user.create.passwordMinLength')),
    role: z.enum(['user', 'admin'])
  })
)
type CreateUserSchema = z.output<typeof schema.value>
const roles = computed(() => [
  { label: t('admin.user.roles.user'), value: 'user' },
  { label: t('admin.user.roles.admin'), value: 'admin' }
])

const createUser = async (event: FormSubmitEvent<CreateUserSchema>) => {
  try {
    creating.value = true
    const { error } = await authClient.admin.createUser({
      name: event.data.name,
      email: event.data.email,
      password: event.data.password,
      role: event.data.role
    })
    if (error) {
      throw error
    }
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
      <UForm id="admin-create-user-form" :state="state" :schema="schema" class="space-y-4" @submit="createUser">
        <UFormField name="name" :label="t('admin.user.create.name')" required>
          <UInput v-model="state.name" class="w-full" />
        </UFormField>
        <UFormField name="email" :label="t('admin.user.create.email')" required>
          <UInput v-model="state.email" type="email" class="w-full" />
        </UFormField>
        <UFormField
          name="password"
          :label="t('admin.user.create.password')"
          :hint="t('admin.user.create.passwordHint')"
          required
        >
          <UInput v-model="state.password" type="password" class="w-full" />
        </UFormField>
        <UFormField name="role" :label="t('admin.user.list.role')" required>
          <USelect v-model="state.role" :items="roles" value-key="value" class="w-full" />
        </UFormField>
      </UForm>
    </template>
    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton variant="outline" :disabled="creating" @click="open = false">{{ t('common.cancel') }}</UButton>
        <UButton type="submit" form="admin-create-user-form" :loading="creating">
          {{ t('admin.user.create.confirm') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
