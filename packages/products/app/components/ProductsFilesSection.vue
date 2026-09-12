<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Asset, Product } from '../../shared/types'
import { withoutFileExtension } from '../../shared/file-name'

interface PurchasedFileRow {
  id: string
  name: string
  englishName: string
  dutchName: string
  type: string
  size: string
  status: Asset['status']
}

const props = defineProps<{ product: Product; editing: boolean }>()
const emit = defineEmits<{ edit: []; saved: []; cancel: [] }>()
const { t } = useI18n()
const api = useProducts()
const toast = useToast()
const assets = ref<Asset[]>([])
const loading = ref(false)
const removing = ref(false)
const selectedFile = ref<PurchasedFileRow>()
const editingMode = ref<'add' | 'edit'>('add')
const editingFileId = ref<string>()
const columns = computed<TableColumn<PurchasedFileRow>[]>(() => [
  { accessorKey: 'name', header: t('products.fileTableName') },
  { accessorKey: 'type', header: t('products.fileTableType') },
  { accessorKey: 'size', header: t('products.fileTableSize') },
  { accessorKey: 'status', header: t('products.fileTableStatus') },
  { accessorKey: 'actions', header: '' }
])
const rows = computed<PurchasedFileRow[]>(() =>
  props.product.fileIds.map((id) => {
    const asset = assets.value.find((item) => item.id === id)
    return {
      id,
      name: asset?.name || id,
      englishName: withoutFileExtension(props.product.fileNames[id]?.en || '', asset?.name || '') || '—',
      dutchName: withoutFileExtension(props.product.fileNames[id]?.nl || '', asset?.name || '') || '—',
      type: asset?.content_type.split('/').pop()?.toUpperCase() || '—',
      size: asset ? formatFileSize(asset.size) : '—',
      status: asset?.status || 'ready'
    }
  })
)

function downloadUrl(id: string, name?: string) {
  const query = new URLSearchParams({ download: '1' })
  if (name && name !== '—') {
    query.set('name', name)
  }
  return `/api/products/admin/products/${encodeURIComponent(props.product.id)}/files/${encodeURIComponent(id)}?${query}`
}
function confirmRemove(file: PurchasedFileRow) {
  selectedFile.value = file
  removing.value = true
}
function startAdding() {
  editingFileId.value = undefined
  editingMode.value = 'add'
  emit('edit')
}
function startEditing(file: PurchasedFileRow) {
  editingFileId.value = file.id
  editingMode.value = 'edit'
  emit('edit')
}
async function removeFile() {
  const file = selectedFile.value
  if (!file) {
    return
  }
  const {
    id: _id,
    updatedAt: _updatedAt,
    categoryName: _categoryName,
    categoryContent: _categoryContent,
    ...input
  } = structuredClone(toRaw(props.product))
  input.fileIds = input.fileIds.filter((id) => id !== file.id)
  Reflect.deleteProperty(input.fileNames, file.id)
  try {
    await api.save(
      {
        ...input,
        isFree: input.isFree ?? false,
        content: {
          en: {
            ...input.content.en,
            subtitle: input.content.en.subtitle || '',
            buyButtonLabel: input.content.en.buyButtonLabel || '',
            secondaryCta: input.content.en.secondaryCta || ''
          },
          nl: {
            ...input.content.nl,
            subtitle: input.content.nl.subtitle || '',
            buyButtonLabel: input.content.nl.buyButtonLabel || '',
            secondaryCta: input.content.nl.secondaryCta || ''
          }
        }
      },
      props.product.id
    )
    removing.value = false
    selectedFile.value = undefined
    emit('saved')
  } catch {
    toast.add({ title: t('products.removePurchasedFileFailed'), color: 'error' })
  }
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}
async function loadAssets() {
  loading.value = true
  try {
    assets.value = await api.assets(props.product.id)
  } finally {
    loading.value = false
  }
}

onMounted(loadAssets)
watch(() => props.product.updatedAt, loadAssets)
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-semibold">{{ t('products.purchasedFiles') }}</h2>
        <div v-if="!editing" class="flex items-center gap-2">
          <UButton icon="i-lucide-plus" variant="outline" @click="startAdding">
            {{ t('products.addPurchasedFile') }}
          </UButton>
        </div>
      </div>
    </template>
    <ProductsForm
      v-if="editing"
      :key="`files-${product.updatedAt}`"
      :product="product"
      section="files"
      :files-mode="editingMode"
      :file-id="editingFileId"
      @saved="emit('saved')"
      @cancel="emit('cancel')"
    />
    <template v-else>
      <UTable v-if="product.fileIds.length" :data="rows" :columns="columns" :loading="loading">
        <template #name-cell="{ row }">
          <div class="flex min-w-0 items-start gap-2">
            <UIcon name="i-lucide-file" class="mt-0.5 size-4 shrink-0 text-muted" />
            <div class="min-w-0 space-y-1">
              <a :href="downloadUrl(row.original.id)" class="block truncate font-medium hover:underline">
                {{ row.original.name }}
              </a>
              <div class="flex min-w-0 flex-col gap-0.5 text-xs text-muted sm:flex-row sm:gap-3">
                <span class="min-w-0">
                  <span aria-hidden="true">🇺🇸</span>
                  <a
                    :href="downloadUrl(row.original.id, row.original.englishName)"
                    class="hover:text-highlighted hover:underline"
                    :class="row.original.englishName === '—' && 'pointer-events-none'"
                    :aria-label="`${t('products.fileTableEnglishName')}: ${row.original.englishName}`"
                    >{{ row.original.englishName }}</a
                  >
                </span>
                <span class="min-w-0">
                  <span aria-hidden="true">🇳🇱</span>
                  <a
                    :href="downloadUrl(row.original.id, row.original.dutchName)"
                    class="hover:text-highlighted hover:underline"
                    :class="row.original.dutchName === '—' && 'pointer-events-none'"
                    :aria-label="`${t('products.fileTableDutchName')}: ${row.original.dutchName}`"
                    >{{ row.original.dutchName }}</a
                  >
                </span>
              </div>
            </div>
          </div>
        </template>
        <template #status-cell="{ row }">
          <UBadge :color="row.original.status === 'ready' ? 'success' : 'neutral'" variant="soft">
            {{ t(`products.assetStatus.${row.original.status}`) }}
          </UBadge>
        </template>
        <template #actions-cell="{ row }">
          <div class="flex items-center justify-end gap-1">
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="xs"
              :aria-label="t('products.editPurchasedFile')"
              @click="startEditing(row.original)"
            />
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="xs"
              :aria-label="t('products.removePurchasedFile')"
              @click="confirmRemove(row.original)"
            />
          </div>
        </template>
      </UTable>
      <p v-else class="text-sm text-muted">{{ t('products.noPurchasedFiles') }}</p>
    </template>
    <ConfirmationModal
      v-if="removing && selectedFile"
      v-model:open="removing"
      title="products.removePurchasedFile"
      message="products.removePurchasedFileConfirm"
      :message-params="{ name: selectedFile.name }"
      confirm-text="products.removePurchasedFile"
      confirm-color="error"
      @confirm="removeFile"
    />
  </UCard>
</template>
