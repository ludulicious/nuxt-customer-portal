<script setup lang="ts">
import type { ProductCategory } from '../../shared/types'
import { categorySchema } from '../../shared/validation'

const emit = defineEmits<{ saved: [category: { id: string; name: string }]; changed: [] }>()
const { t } = useI18n()
const api = useProducts()
const categories = ref<ProductCategory[]>([])
const state = reactive({ name: '' })
const schema = useProductFormSchema(categorySchema)
const categoryForm = useTemplateRef('categoryForm')
const editing = ref(''),
  deleting = ref<ProductCategory>(),
  error = ref(''),
  busy = ref(false)
const deleteState = reactive({ name: '' })
async function load() {
  categories.value = await api.categories()
}
onMounted(() =>
  load().catch(() => {
    error.value = t('products.loadFailed')
  })
)
function cancel() {
  editing.value = ''
  state.name = ''
}
async function save() {
  busy.value = true
  error.value = ''
  try {
    const category = await api.saveCategory(state.name, editing.value || undefined)
    cancel()
    await load()
    emit('saved', category)
    emit('changed')
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode === 409) {
      categoryForm.value?.setErrors([{ name: 'name', message: t('products.categoryDuplicate') }])
    } else {
      error.value = t('products.saveFailed')
    }
  } finally {
    busy.value = false
  }
}
async function remove() {
  if (!deleting.value) {
    return
  }
  busy.value = true
  error.value = ''
  try {
    await api.deleteCategory(deleting.value.id, deleteState.name)
    deleting.value = undefined
    await load()
    emit('changed')
  } catch {
    error.value = t('products.categoryDeleteFailed')
  } finally {
    busy.value = false
  }
}
function edit(category: ProductCategory) {
  editing.value = category.id
  state.name = category.name
  deleting.value = undefined
}
function confirmDelete(category: ProductCategory) {
  cancel()
  deleting.value = category
  deleteState.name = ''
}
</script>

<template>
  <div class="space-y-4">
    <p class="text-sm text-muted">{{ t('products.categoriesHelp') }}</p>
    <UAlert v-if="error" color="error" :title="error" />
    <UForm :state="state" :schema="schema" novalidate class="flex flex-wrap items-end gap-3" @submit="save">
      <UFormField name="name" :label="t('products.categoryName')"
        ><UInput v-model="state.name" :disabled="busy"
      /></UFormField>
      <UButton type="submit" :loading="busy">{{ t(editing ? 'products.save' : 'products.addCategory') }}</UButton>
      <UButton v-if="editing" variant="outline" color="neutral" :disabled="busy" @click="cancel">{{
        t('products.cancel')
      }}</UButton>
    </UForm>
    <p v-if="!categories.length" class="text-muted">{{ t('products.noCategories') }}</p>
    <div v-for="category in categories" :key="category.id" class="rounded-lg border p-3">
      <div class="flex items-center justify-between gap-3">
        <div>
          <span class="font-medium">{{ category.name }}</span>
          <p class="text-sm text-muted">{{ t('products.categoryUsage', { count: category.productCount }) }}</p>
        </div>
        <div class="flex gap-1">
          <UButton
            icon="i-lucide-pencil"
            variant="ghost"
            :aria-label="t('products.editCategory', { name: category.name })"
            :disabled="busy"
            @click="edit(category)"
          />
          <UButton
            icon="i-lucide-trash-2"
            variant="ghost"
            color="neutral"
            :aria-label="t('products.deleteCategory', { name: category.name })"
            :disabled="busy || category.productCount > 0"
            @click="confirmDelete(category)"
          />
        </div>
      </div>
      <UForm
        v-if="deleting?.id === category.id"
        :state="deleteState"
        :schema="schema"
        novalidate
        class="mt-3 space-y-3"
        @submit="remove"
      >
        <p>{{ t('products.categoryDeleteConfirm', { name: category.name }) }}</p>
        <UFormField name="name" :label="t('products.typeName')"><UInput v-model="deleteState.name" /></UFormField>
        <div class="flex justify-end gap-3">
          <UButton variant="outline" color="neutral" :disabled="busy" @click="deleting = undefined">{{
            t('products.cancel')
          }}</UButton
          ><UButton type="submit" color="error" :loading="busy">{{ t('products.delete') }}</UButton>
        </div>
      </UForm>
    </div>
  </div>
</template>
