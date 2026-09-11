<script setup lang="ts">
import { keySchema } from '../../shared/validation'

const { t } = useI18n(),
  api = useProducts(),
  keyState = reactive({ name: '', expiresAt: null as string | null }),
  expiry = ref(''),
  shownKey = ref(''),
  error = ref(''),
  busy = ref(false),
  revoking = ref('')
const apiSchema = useProductFormSchema(keySchema)
const keys = ref<Awaited<ReturnType<typeof api.keys>>>([])
onMounted(async () => {
  try {
    keys.value = await api.keys()
  } catch {
    error.value = t('products.loadFailed')
  }
})
async function createKey() {
  busy.value = true
  error.value = ''
  try {
    shownKey.value = (
      await api.createKey({ ...keyState, expiresAt: expiry.value ? new Date(expiry.value).toISOString() : null })
    ).key
    keyState.name = ''
    keys.value = await api.keys()
  } catch {
    error.value = t('products.saveFailed')
  } finally {
    busy.value = false
  }
}
async function revoke() {
  await api.revoke(revoking.value)
  revoking.value = ''
  keys.value = await api.keys()
}
</script>

<template>
  <div class="space-y-4 rounded-lg border border-default p-5">
    <UAlert v-if="error" color="error" :title="error" />
    <h2 class="text-xl font-semibold">{{ t('products.apiKeys') }}</h2>
    <p class="text-muted">{{ t('products.keyHelp') }}</p>
    <UAlert v-if="shownKey" :title="t('products.copyKey')"
      ><template #description
        ><code class="break-all select-all">{{ shownKey }}</code
        ><UButton class="ml-3" variant="ghost" @click="shownKey = ''">{{ t('products.close') }}</UButton></template
      ></UAlert
    ><UForm :state="keyState" :schema="apiSchema" novalidate class="flex flex-wrap items-end gap-3" @submit="createKey"
      ><UFormField name="name" :label="t('products.websiteName')"><UInput v-model="keyState.name" /></UFormField
      ><UFormField name="expiresAt" :label="t('products.expires')"
        ><UInput v-model="expiry" type="datetime-local" /></UFormField
      ><UButton type="submit" :loading="busy">{{ t('products.createKey') }}</UButton></UForm
    >
    <div v-for="key in keys" :key="key.id" class="rounded-lg border p-4">
      <div class="flex justify-between">
        <div>
          <strong>{{ key.name }}</strong>
          <p class="text-sm text-muted">
            {{ key.prefix }}… ·
            {{ key.last_used_at ? new Date(key.last_used_at).toLocaleString() : t('products.neverUsed') }}
          </p>
          <p v-if="key.revoked_at">{{ t('products.revoked') }}</p>
        </div>
        <UButton v-if="!key.revoked_at" variant="outline" color="neutral" @click="revoking = key.id">{{
          t('products.revoke')
        }}</UButton>
      </div>
      <div v-if="revoking === key.id" class="mt-3 flex flex-wrap items-center gap-3">
        <p>{{ t('products.revokeConfirm', { name: key.name }) }}</p>
        <UButton variant="outline" color="neutral" @click="revoking = ''">{{ t('products.cancel') }}</UButton
        ><UButton color="error" @click="revoke">{{ t('products.revoke') }}</UButton>
      </div>
    </div>
  </div>
</template>
