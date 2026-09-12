<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { apiKeySchema } from '../../../shared/api-key'

type ApiKeyRow = Awaited<ReturnType<ReturnType<typeof useAdministration>['keys']>>[number]

const { t, locale } = useI18n()
const api = useAdministration()
const portalFeatures = usePortalFeatures()
const toast = useToast()
const apiSchema = apiKeySchema
const keys = ref<ApiKeyRow[]>([])
const createOpen = ref(false)
const shownKey = ref('')
const loading = ref(true)
const busy = ref(false)
const showRevokeModal = ref(false)
const selectedKey = ref<ApiKeyRow | null>(null)
const keyState = reactive({ name: '', expiresAt: undefined as string | undefined, scopes: [] as string[] })

const availableScopes = computed(() => portalFeatures.features.value.flatMap((feature) => feature.apiScopes ?? []))
const scopeItems = computed(() =>
  availableScopes.value.map((scope) => ({
    label: t(scope.labelKey),
    description: scope.descriptionKey ? t(scope.descriptionKey) : undefined,
    value: `${scope.id}:${scope.action}`
  }))
)
const columns = computed<TableColumn<ApiKeyRow>[]>(() => [
  { accessorKey: 'name', header: t('admin.apiKeys.websiteName') },
  { accessorKey: 'permissions', header: t('admin.apiKeys.permissions') },
  { accessorKey: 'createdAt', header: t('admin.apiKeys.created') },
  { accessorKey: 'lastUsedAt', header: t('admin.apiKeys.lastUsed') },
  { accessorKey: 'expiresAt', header: t('admin.apiKeys.expiresAt') },
  { accessorKey: 'status', header: t('admin.apiKeys.status') },
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
function openRevoke(key: ApiKeyRow) {
  selectedKey.value = key
  showRevokeModal.value = true
}
async function loadKeys() {
  loading.value = true
  try {
    keys.value = await api.keys()
  } catch {
    toast.add({ title: t('admin.apiKeys.loadFailed'), color: 'error' })
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
    toast.add({ title: t('admin.apiKeys.saveFailed'), color: 'error' })
  } finally {
    busy.value = false
  }
}
async function revoke() {
  busy.value = true
  try {
    const deletedId = selectedKey.value!.id
    await api.revoke(deletedId)
    keys.value = keys.value.filter((key) => key.id !== deletedId)
    await loadKeys()
    toast.add({ title: t('admin.apiKeys.keyRevoked'), color: 'success' })
  } catch {
    toast.add({ title: t('admin.apiKeys.saveFailed'), color: 'error' })
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
          <h2 class="font-semibold text-highlighted">{{ t('admin.apiKeys.title') }}</h2>
          <p class="text-sm text-muted">{{ t('admin.apiKeys.keyHelp') }}</p>
        </div>
        <UButton icon="i-lucide-plus" variant="outline" @click="openCreate">
          {{ t('admin.apiKeys.newApiKey') }}
        </UButton>
      </div>
    </template>

    <div class="space-y-4">
      <UAlert color="info" variant="subtle" icon="i-lucide-info" :title="t('admin.apiKeys.providerKeysOnlyTitle')" />
      <UTable :data="keys" :columns="columns" :loading="loading">
        <template #name-cell="{ row }">
          <div>
            <p class="font-medium text-highlighted">{{ row.original.name || t('admin.apiKeys.unnamedKey') }}</p>
            <p class="font-mono text-xs text-muted">{{ row.original.prefix }}…</p>
          </div>
        </template>
        <template #permissions-cell="{ row }">
          <div class="flex max-w-72 flex-wrap gap-1">
            <UBadge
              v-for="(actions, resource) in row.original.permissions"
              :key="resource"
              color="neutral"
              variant="subtle"
            >
              {{ resource }}: {{ actions.join(', ') }}
            </UBadge>
          </div>
        </template>
        <template #createdAt-cell="{ row }">{{ formatDate(row.original.createdAt) }}</template>
        <template #lastUsedAt-cell="{ row }">{{
          row.original.lastUsedAt ? formatDate(row.original.lastUsedAt) : t('admin.apiKeys.neverUsed')
        }}</template>
        <template #expiresAt-cell="{ row }">{{ formatDate(row.original.expiresAt) }}</template>
        <template #status-cell="{ row }">
          <UBadge :color="row.original.enabled ? 'success' : 'neutral'" variant="soft">
            {{ row.original.enabled ? t('admin.apiKeys.active') : t('admin.apiKeys.revoked') }}
          </UBadge>
        </template>
        <template #actions-cell="{ row }">
          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            size="xs"
            :aria-label="t('admin.apiKeys.revoke')"
            @click="openRevoke(row.original)"
          />
        </template>
        <template #empty>
          <div class="py-8 text-center text-sm text-muted">{{ t('admin.apiKeys.noApiKeys') }}</div>
        </template>
      </UTable>
    </div>

    <UModal v-if="createOpen" v-model:open="createOpen" :title="t('admin.apiKeys.newApiKey')" :ui="{ content: 'pointer-events-auto' }">
      <template #body>
        <div class="space-y-4">
          <UAlert v-if="shownKey" color="success" variant="subtle" :title="t('admin.apiKeys.copyKey')">
            <template #description
              ><code class="mt-2 block break-all select-all">{{ shownKey }}</code></template
            >
          </UAlert>
          <UForm v-else :state="keyState" :schema="apiSchema" novalidate class="space-y-4" @submit="createKey">
            <UFormField name="name" :label="t('admin.apiKeys.websiteName')">
              <UInput v-model="keyState.name" class="w-full" autofocus />
            </UFormField>
            <UFormField name="expiresAt" :label="t('admin.apiKeys.expires')">
              <UInput v-model="keyState.expiresAt" type="datetime-local" class="w-full" />
            </UFormField>
            <UFormField name="scopes" :label="t('admin.apiKeys.permissions')">
              <UCheckboxGroup v-model="keyState.scopes" :items="scopeItems" />
            </UFormField>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="outline" @click="createOpen = false">{{
                t('admin.apiKeys.cancel')
              }}</UButton>
              <UButton type="submit" :loading="busy">{{ t('admin.apiKeys.createKey') }}</UButton>
            </div>
          </UForm>
          <div v-if="shownKey" class="flex justify-end">
            <UButton @click="createOpen = false">{{ t('admin.apiKeys.close') }}</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <ConfirmationModal
      v-if="showRevokeModal && selectedKey"
      v-model:open="showRevokeModal"
      title="admin.apiKeys.revoke"
      message="admin.apiKeys.revokeConfirm"
      :message-params="{ name: selectedKey.name || '' }"
      confirm-text="admin.apiKeys.revoke"
      confirm-color="error"
      @confirm="revoke"
    />
  </UCard>
</template>
