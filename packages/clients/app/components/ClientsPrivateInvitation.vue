<script setup lang="ts">
import { z } from 'zod'

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ success: [] }>()
const { t, locale } = useI18n()
const toast = useToast()
const state = reactive({ clientId: '', name: '', email: '' })
const existing = ref(false)
const busy = ref(false)
const error = ref('')
const requestId = ref('')
const api = useClients()
const clients = ref<{ id: string; name: string; email: string | null }[]>([])
const schema = computed(() =>
  z.object({
    clientId: existing.value ? z.string().min(1, t('features.clients.choosePrivateClient')) : z.string(),
    name: existing.value ? z.string() : z.string().trim().min(2, t('features.clients.validation.name')).max(160),
    email: z.string().trim().email(t('features.clients.validation.email'))
  })
)
watch(open, async (value) => {
  if (!value) {
    return
  }
  Object.assign(state, { clientId: '', name: '', email: '' })
  existing.value = false
  requestId.value = crypto.randomUUID()
  error.value = ''
  try {
    clients.value = await api.invitablePrivateClients()
  } catch {
    error.value = t('features.clients.inviteFailed')
  }
})
watch(
  () => state.clientId,
  (id) => {
    state.email = clients.value.find((client) => client.id === id)?.email ?? ''
  }
)
async function submit() {
  busy.value = true
  error.value = ''
  try {
    const result = await api.invitePrivateClient({
      requestId: requestId.value,
      preferredLocale: locale.value === 'nl' ? 'nl' : 'en',
      email: state.email,
      ...(existing.value ? { clientId: state.clientId } : { name: state.name })
    })
    open.value = false
    emit('success')
    await refreshNuxtData('admin-pending-invitations')
    toast.add({
      title: t(
        result.deliveryFailed ? 'features.clients.invitationDeliveryFailed' : 'features.clients.invitationCreated'
      ),
      color: result.deliveryFailed ? 'warning' : 'success'
    })
  } catch (cause) {
    error.value = (cause as { data?: { message?: string } }).data?.message || t('features.clients.inviteFailed')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal
    v-if="open"
    v-model:open="open"
    :title="t('features.clients.invitePrivateClient')"
    :description="t('features.clients.privateInviteDescription')"
    :dismissible="!busy"
  >
    <template #body>
      <UForm :schema="schema" :state="state" novalidate class="space-y-4" @submit="submit">
        <USwitch
          v-if="clients.length"
          v-model="existing"
          :label="t('features.clients.useExistingPrivateClient')"
          :disabled="busy"
        />
        <UFormField v-if="existing" name="clientId" :label="t('features.clients.choosePrivateClient')">
          <USelectMenu
            v-model="state.clientId"
            :items="clients.map((client) => ({ label: client.name, value: client.id }))"
            value-key="value"
            class="w-full"
            :disabled="busy"
          />
        </UFormField>
        <UFormField v-else name="name" :label="t('features.clients.fullName')">
          <UInput v-model="state.name" autocomplete="name" class="w-full" :disabled="busy" />
        </UFormField>
        <UFormField name="email" :label="t('features.clients.invoiceEmail')">
          <UInput v-model="state.email" autocomplete="email" class="w-full" :disabled="busy" />
        </UFormField>
        <UAlert v-if="error" color="error" :title="error" />
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" :disabled="busy" @click="open = false">{{
            t('features.clients.cancel')
          }}</UButton>
          <UButton type="submit" icon="i-lucide-mail-plus" :loading="busy">{{ t('features.clients.invite') }}</UButton>
        </div>
      </UForm>
    </template>
  </UModal>
</template>
