<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { keySchema } from '../../shared/validation'

type ApiKeyRow = Awaited<ReturnType<ReturnType<typeof useProducts>['keys']>>[number]

const { t, locale } = useI18n()
const api = useProducts()
const portalFeatures = usePortalFeatures()
const toast = useToast()
const apiSchema = useProductFormSchema(keySchema, (issue) =>
  issue.path[0] === 'scopes' && issue.code === 'too_small' ? t('products.selectPermission') : undefined
)
const keys = ref<ApiKeyRow[]>([])
const createOpen = ref(false)
const shownKey = ref('')
const loading = ref(true)
const busy = ref(false)
const revoking = ref('')
const keyState = reactive({ name: '', expiresAt: undefined as string | undefined, scopes: [] as string[] })

const availableScopes = computed(() => portalFeatures.features.value.flatMap((feature) => feature.apiScopes ?? []))
const scopeItems = computed(() => availableScopes.value.map((scope) => ({
  label: t(scope.labelKey),
  description: scope.descriptionKey ? t(scope.descriptionKey) : undefined,
  value: `${scope.id}:${scope.action}`
})))
const columns = computed<TableColumn<ApiKeyRow>[]>(() => [
  { accessorKey: 'name', header: t('products.websiteName') },
  { accessorKey: 'permissions', header: t('products.permissions') },
  { accessorKey: 'createdAt', header: t('products.created') },
  { accessorKey: 'lastUsedAt', header: t('products.lastUsed') },
  { accessorKey: 'expiresAt', header: t('products.expiresAt') },
  { accessorKey: 'status', header: t('products.status') },
  { accessorKey: 'actions', header: '' }
])

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : '—'
}
function resetForm() {
  keyState.name = ''
  keyState.expiresAt = undefined
  keyState.scopes = availableScopes.value.length
    ? [`${availableScopes.value[0]!.id}:${availableScopes.value[0]!.action}`]
    : []
}
function openCreate() {
  resetForm()
  shownKey.value = ''
  createOpen.value = true
}
async function loadKeys() {
  loading.value = true
  try {
    keys.value = await api.keys()
  } catch {
    toast.add({ title: t('products.loadFailed'), color: 'error' })
  } finally {
    loading.value = false
  }
}
async function createKey() {
  busy.value = true
  try {
    shownKey.value = (await api.createKey(keyState)).key
    await loadKeys()
  } catch {
    toast.add({ title: t('products.saveFailed'), color: 'error' })
  } finally {
    busy.value = false
  }
}
async function revoke() {
  busy.value = true
  try {
    await api.revoke(revoking.value)
    revoking.value = ''
    await loadKeys()
    toast.add({ title: t('products.keyRevoked'), color: 'success' })
  } catch {
    toast.add({ title: t('products.saveFailed'), color: 'error' })
  } finally {
    busy.value = false
  }
}

onMounted(loadKeys)
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="font-semibold text-highlighted">{{ t('products.apiKeys') }}</h2>
          <p class="text-sm text-muted">{{ t('products.keyHelp') }}</p>
        </div>
        <UButton icon="i-lucide-plus" variant="outline" @click="openCreate">
          {{ t('products.newApiKey') }}
        </UButton>
      </div>
    </template>

    <div class="space-y-4">
      <UAlert
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        :title="t('products.providerKeysOnlyTitle')"
      />
      <UTable :data="keys" :columns="columns" :loading="loading">
        <template #name-cell="{ row }">
          <div>
            <p class="font-medium text-highlighted">{{ row.original.name || t('products.unnamedKey') }}</p>
            <p class="font-mono text-xs text-muted">{{ row.original.prefix }}…</p>
          </div>
        </template>
        <template #permissions-cell="{ row }">
          <div class="flex max-w-72 flex-wrap gap-1">
            <UBadge v-for="(actions, resource) in row.original.permissions" :key="resource" color="neutral" variant="subtle">
              {{ resource }}: {{ actions.join(', ') }}
            </UBadge>
          </div>
        </template>
        <template #createdAt-cell="{ row }">{{ formatDate(row.original.createdAt) }}</template>
        <template #lastUsedAt-cell="{ row }">{{ row.original.lastUsedAt ? formatDate(row.original.lastUsedAt) : t('products.neverUsed') }}</template>
        <template #expiresAt-cell="{ row }">{{ formatDate(row.original.expiresAt) }}</template>
        <template #status-cell="{ row }">
          <UBadge :color="row.original.enabled ? 'success' : 'neutral'" variant="soft">
            {{ row.original.enabled ? t('products.active') : t('products.revoked') }}
          </UBadge>
        </template>
        <template #actions-cell="{ row }">
          <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" :aria-label="t('products.revoke')" @click="revoking = row.original.id" />
        </template>
        <template #empty>
          <div class="py-8 text-center text-sm text-muted">{{ t('products.noApiKeys') }}</div>
        </template>
      </UTable>
    </div>

    <UModal v-model:open="createOpen" :title="t('products.newApiKey')" :ui="{ content: 'pointer-events-auto' }">
      <template #body>
        <div class="space-y-4">
          <UAlert v-if="shownKey" color="success" variant="subtle" :title="t('products.copyKey')">
            <template #description><code class="mt-2 block break-all select-all">{{ shownKey }}</code></template>
          </UAlert>
          <UForm v-else :state="keyState" :schema="apiSchema" novalidate class="space-y-4" @submit="createKey">
            <UFormField name="name" :label="t('products.websiteName')">
              <UInput v-model="keyState.name" class="w-full" autofocus />
            </UFormField>
            <UFormField name="expiresAt" :label="t('products.expires')">
              <UInput v-model="keyState.expiresAt" type="datetime-local" class="w-full" />
            </UFormField>
            <UFormField name="scopes" :label="t('products.permissions')">
              <UCheckboxGroup v-model="keyState.scopes" :items="scopeItems" />
            </UFormField>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="outline" @click="createOpen = false">{{ t('products.cancel') }}</UButton>
              <UButton type="submit" :loading="busy">{{ t('products.createKey') }}</UButton>
            </div>
          </UForm>
          <div v-if="shownKey" class="flex justify-end">
            <UButton @click="createOpen = false">{{ t('products.close') }}</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <ConfirmationModal
      :open="Boolean(revoking)"
      title="products.revoke"
      message="products.revokeConfirm"
      :message-params="{ name: keys.find((key) => key.id === revoking)?.name || '' }"
      confirm-text="products.revoke"
      confirm-color="error"
      @update:open="(open) => { if (!open) revoking = '' }"
      @confirm="revoke"
    />
  </UCard>
</template>
