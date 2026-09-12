<script setup lang="ts">
import { z } from 'zod'
import type { StorageSettings } from '../../shared/types'

const props = defineProps<{ storage: StorageSettings }>()
const emit = defineEmits<{ changed: [] }>()
const api = useProducts(),
  { t } = useI18n(),
  toast = useToast()
const busy = ref(false),
  error = ref(''),
  removing = ref(false),
  testedCurrent = ref(false)
const state = reactive({
  provider: 's3' as 's3' | 'bunny',
  endpoint: '',
  region: 'us-east-1',
  bucket: '',
  accessKeyId: '',
  secretAccessKey: '',
  pathStyle: false
})
const schema = z.object({
  provider: z.enum(['s3', 'bunny']),
  endpoint: z
    .string()
    .trim()
    .refine((value) => !value || /^https?:\/\//.test(value), t('products.storageEndpointInvalid'))
    .refine((value) => state.provider !== 'bunny' || Boolean(value), t('products.storageBunnyEndpointRequired')),
  region: z.string().trim().refine((value) => state.provider === 'bunny' || Boolean(value), t('products.storageRegionRequired')),
  bucket: z.string().trim().min(3, t('products.storageBucketRequired')),
  accessKeyId: z.string().trim().refine((value) => state.provider === 'bunny' || value.length >= 3, t('products.storageAccessKeyRequired')),
  secretAccessKey: z
    .string()
    .refine((value) => props.storage.configured || value.length >= 8, t('products.storageSecretRequired')),
  pathStyle: z.boolean()
})
watch(
  () => props.storage,
  (value) =>
    Object.assign(state, {
      provider: value.provider,
      endpoint: value.endpoint || (value.provider === 'bunny' ? 'https://storage.bunnycdn.com' : ''),
      region: value.region,
      bucket: value.bucket,
      accessKeyId: value.accessKeySuffix ? `••••${value.accessKeySuffix}` : '',
      secretAccessKey: '',
      pathStyle: value.pathStyle
    }),
  { immediate: true }
)
const locked = computed(() => props.storage.source === 'environment')
const providerItems = computed(() => [
  { label: t('products.storageProviderS3'), value: 's3' },
  { label: t('products.storageProviderBunny'), value: 'bunny' }
])
watch(
  () => state.provider,
  (provider) => {
    if (provider === 'bunny' && !state.endpoint) {
      state.endpoint = 'https://storage.bunnycdn.com'
    }
  }
)
watch(state, () => (testedCurrent.value = false), { deep: true })
const storageInput = () => ({
  ...state,
  accessKeyId: state.provider === 'bunny' || state.accessKeyId.startsWith('••••') ? undefined : state.accessKeyId,
  secretAccessKey: state.secretAccessKey || undefined
})
async function save() {
  busy.value = true
  error.value = ''
  try {
    await api.saveStorage(storageInput())
    state.secretAccessKey = ''
    toast.add({ title: t('products.storageSaved'), color: 'success' })
    emit('changed')
  } catch (value) {
    error.value = (value as { data?: { message?: string } }).data?.message || t('products.storageSaveFailed')
  } finally {
    busy.value = false
  }
}
async function test() {
  busy.value = true
  error.value = ''
  try {
    await api.testStorage(storageInput())
    testedCurrent.value = true
    toast.add({ title: t('products.storageTestPassed'), color: 'success' })
  } catch (value) {
    const message = (value as { data?: { message?: string } }).data?.message
    toast.add({ title: message || t('products.storageTestFailed'), color: 'error' })
  } finally {
    busy.value = false
  }
}
async function remove() {
  busy.value = true
  try {
    await api.removeStorage()
    removing.value = false
    emit('changed')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-4 pt-4">
    <UAlert
      v-if="locked"
      color="info"
      variant="subtle"
      :title="t('products.storageManagedExternally')"
      :description="t('products.storageManagedExternallyHelp')"
    />
    <UAlert v-if="error" color="error" variant="subtle" :title="error" />
    <UForm :state="state" :schema="schema" novalidate class="space-y-4 rounded-lg border p-5" @submit="save">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="font-semibold">{{ t('products.storageObject') }}</h2>
          <p class="text-sm text-muted">
            {{ t(storage.tested || testedCurrent ? 'products.storageTested' : 'products.storageNotTested') }}
          </p>
        </div>
        <UBadge :color="storage.configured ? 'success' : 'neutral'">{{
          t(storage.configured ? 'products.configured' : 'products.missing')
        }}</UBadge>
      </div>
      <UFormField name="provider" :label="t('products.storageProvider')">
        <USelect v-model="state.provider" :items="providerItems" :disabled="locked || storage.configured" class="w-full" />
        <template #help>
          <span>{{ t(state.provider === 'bunny' ? 'products.storageBunnyHelp' : 'products.storageS3Help') }}</span>
        </template>
      </UFormField>
      <UFormField name="endpoint" :label="t(state.provider === 'bunny' ? 'products.storageBunnyEndpoint' : 'products.storageEndpoint')"
        ><UInput
          v-model="state.endpoint"
          :disabled="locked"
          :placeholder="state.provider === 'bunny' ? 'https://storage.bunnycdn.com' : 'https://s3.example.com'"
          class="w-full"
        />
        <template v-if="state.provider === 'bunny'" #help>{{ t('products.storageBunnyEndpointHelp') }}</template>
      </UFormField>
      <div v-if="state.provider === 's3'">
        <UFormField name="region" :label="t('products.storageRegion')"
          ><UInput v-model="state.region" :disabled="locked" class="w-full"
        /></UFormField>
      </div>
      <UFormField name="bucket" :label="t(state.provider === 'bunny' ? 'products.storageBunnyZone' : 'products.storageBucket')"
        ><UInput v-model="state.bucket" :disabled="locked" class="w-full"
      /></UFormField>
      <UFormField v-if="state.provider === 's3'" name="accessKeyId" :label="t('products.storageAccessKey')"
        ><UInput v-model="state.accessKeyId" :disabled="locked" autocomplete="off" class="w-full"
      /></UFormField>
      <UFormField
        name="secretAccessKey"
        :label="state.provider === 'bunny'
          ? (storage.configured ? t('products.storageReplaceBunnyPassword') : t('products.storageBunnyPassword'))
          : (storage.configured ? t('products.storageReplaceSecret') : t('products.storageSecretKey'))"
        ><UInput
          v-model="state.secretAccessKey"
          :disabled="locked"
          type="password"
          autocomplete="new-password"
          class="w-full"
      /></UFormField>
      <UFormField v-if="state.provider === 's3'" name="pathStyle" :label="t('products.storagePathStyle')"
        ><USwitch v-model="state.pathStyle" :disabled="locked"
      /></UFormField>
      <div class="flex flex-wrap justify-end gap-3">
        <UButton
          v-if="storage.configured"
          color="error"
          variant="outline"
          :disabled="locked"
          :loading="busy"
          @click="removing = true"
          >{{ t('products.storageRemove') }}</UButton
        >
        <UButton type="button" variant="outline" :disabled="locked && !storage.configured" :loading="busy" @click="test">{{
          t('products.storageTest')
        }}</UButton>
        <UButton type="submit" :disabled="locked" :loading="busy">{{ t('products.save') }}</UButton>
      </div>
    </UForm>
    <ConfirmationModal
      v-if="removing"
      v-model:open="removing"
      title="products.storageRemove"
      message="products.storageRemoveConfirm"
      confirm-text="products.storageRemove"
      confirm-color="error"
      @confirm="remove"
    />
  </div>
</template>
