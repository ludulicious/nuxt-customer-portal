<script setup lang="ts">
import { publishChecks } from '../../shared/publish'
import { productSchema } from '../../shared/validation'
import { portalLanguages } from '@nuxt-customer-portal/core/shared/languages'

const props = defineProps<{ productId: string }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [] }>()
const api = useProducts()
const { t } = useI18n()
const busy = ref(false)
const loading = ref(false)
const error = ref('')
const product = ref<Awaited<ReturnType<typeof api.get>>>()
const settings = ref<Awaited<ReturnType<typeof api.settings>>>()
const checks = computed(() => (product.value && settings.value ? publishChecks(product.value, settings.value) : []))
const allowed = computed(() => checks.value.length > 0 && checks.value.every((check) => check.passed || check.warning))
watch(open, async (value) => {
  if (!value) {
    return
  }
  error.value = ''
  product.value = undefined
  settings.value = undefined
  loading.value = true
  try {
    ;[product.value, settings.value] = await Promise.all([api.get(props.productId), api.settings()])
  } catch {
    error.value = t('products.loadFailed')
  } finally {
    loading.value = false
  }
})
async function publish() {
  if (!allowed.value || busy.value || !product.value) {
    return
  }
  busy.value = true
  error.value = ''
  try {
    await api.save(productSchema.parse({ ...product.value, status: 'published' }), props.productId)
    open.value = false
    emit('saved')
  } catch {
    error.value = t('products.publishChanged')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal
    v-if="open"
    v-model:open="open"
    :title="t('products.publishReview')"
    :dismissible="!busy"
    :close="!busy"
    :ui="{ content: 'pointer-events-auto' }"
  >
    <template #body>
      <div class="space-y-4">
        <p v-if="!loading && checks.length">
          {{
            t(allowed ? 'products.publishConfirm' : 'products.publishBlocked', {
              name: product?.content[settings?.defaultLocale || 'en'].title || ''
            })
          }}
        </p>
        <p v-if="loading" role="status">{{ t('products.loading') }}</p>
        <UAlert v-if="error" color="error" :title="error" />
        <ul class="space-y-3">
          <li v-for="check in checks" :key="`${check.key}-${check.value}`" class="flex items-start gap-3 text-sm">
            <UIcon
              :name="check.passed || check.warning ? 'i-lucide-circle-check' : 'i-lucide-circle-x'"
              :class="[
                'mt-0.5 size-5 shrink-0',
                check.passed ? 'text-success' : check.warning ? 'text-warning' : 'text-error'
              ]"
              aria-hidden="true"
            />
            <span
              ><span class="sr-only"
                >{{
                  t(
                    check.passed
                      ? 'products.checkPassed'
                      : check.warning
                        ? 'products.checkWarning'
                        : 'products.checkFailed'
                  )
                }}: </span
              >{{
                t(`products.${check.key}`, {
                  value: portalLanguages.find((language) => language.value === check.value)?.label || check.value
                })
              }}</span
            >
          </li>
        </ul>
        <div class="flex justify-end gap-3">
          <UButton color="neutral" variant="outline" :disabled="busy" @click="open = false">{{
            t(allowed && !loading ? 'products.cancel' : 'products.close')
          }}</UButton>
          <UButton v-if="allowed && !loading" :disabled="busy" :loading="busy" icon="i-lucide-globe" @click="publish">{{
            t('products.publish')
          }}</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
