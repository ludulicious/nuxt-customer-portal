<script setup lang="ts">
import { z } from 'zod'
import type { Product } from '../../shared/types'

const props = defineProps<{ product: Product }>()
const emit = defineEmits<{ deleted: [] }>()
const { t } = useI18n()
const api = useProducts()
const open = ref(false),
  pending = ref(false),
  eligible = ref(false),
  busy = ref(false),
  error = ref('')
const state = reactive({ name: '' })
const schema = useProductFormSchema(z.object({ name: z.string().min(1) }))
watch(open, async (value) => {
  if (!value) {
    return
  }
  state.name = ''
  error.value = ''
  eligible.value = false
  pending.value = true
  try {
    eligible.value = (await api.deletion(props.product.id)).eligible
  } catch {
    error.value = t('products.loadFailed')
  } finally {
    pending.value = false
  }
})
async function remove() {
  busy.value = true
  error.value = ''
  try {
    await api.remove(props.product.id, state.name)
    open.value = false
    emit('deleted')
  } catch {
    error.value = t('products.deleteFailed')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UButton color="neutral" variant="ghost" icon="i-lucide-trash-2" @click="open = true">{{
    t('products.delete')
  }}</UButton>
  <UModal v-model:open="open" :title="t('products.delete')" :ui="{ content: 'pointer-events-auto' }">
    <template #body>
      <p v-if="pending" role="status">{{ t('products.loading') }}</p>
      <UForm v-else :state="state" :schema="schema" novalidate class="space-y-4" @submit="remove">
        <UAlert v-if="error" color="error" :title="error" />
        <p>
          {{
            t(eligible ? 'products.deleteConfirm' : 'products.archiveInstead', {
              name: product.content.en.title || product.content.nl.title
            })
          }}
        </p>
        <UFormField v-if="eligible" name="name" :label="t('products.typeName')"
          ><UInput v-model="state.name" class="w-full"
        /></UFormField>
        <div class="flex justify-end gap-3">
          <UButton color="neutral" variant="outline" :disabled="busy" @click="open = false">{{
            t('products.cancel')
          }}</UButton>
          <UButton v-if="eligible" type="submit" color="error" icon="i-lucide-trash-2" :loading="busy">{{
            t('products.delete')
          }}</UButton>
        </div>
      </UForm>
    </template>
  </UModal>
</template>
