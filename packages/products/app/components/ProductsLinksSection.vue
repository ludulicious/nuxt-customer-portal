<script setup lang="ts">
import type { z } from 'zod'
import type { Product, Locale } from '../../shared/types'
import { purchasedLinkSchema, type PurchasedLink } from '../../shared/links'

const props = defineProps<{ product: Product; editing: boolean }>()
const emit = defineEmits<{ saved: []; edit: []; cancel: [] }>()
const { t, locale } = useI18n()
const api = useProducts()
const settings = await api.settings()
const languages = settings.languages
const removing = ref(false)
const selected = ref<PurchasedLink>()
const busy = ref(false)
const error = ref('')
const form = useTemplateRef('form')
const state = reactive({ id: '', url: '', labels: { en: '', nl: '' } })
const links = computed(() => props.product.links || [])
const name = (link: PurchasedLink) =>
  link.labels[locale.value as Locale] || link.labels.en || link.labels.nl || link.url
const schema = useProductFormSchema(
  purchasedLinkSchema.superRefine((value, ctx) => {
    for (const language of languages) {
      if (!value.labels[language]) {
        ctx.addIssue({ code: 'custom', path: ['labels', language], message: 'Label required' })
      }
    }
  }),
  (issue: z.ZodIssue) => {
    if (issue.path[0] === 'url' && issue.code === 'custom') {
      return t('products.linkUrlInvalid')
    }
    if (issue.path[0] === 'labels' && issue.code === 'custom') {
      return t('products.linkLabelRequired')
    }
  }
)
function edit(link?: PurchasedLink) {
  Object.assign(
    state,
    link ? structuredClone(toRaw(link)) : { id: crypto.randomUUID(), url: '', labels: { en: '', nl: '' } }
  )
  error.value = ''
  emit('edit')
}
async function persist(next: PurchasedLink[]) {
  busy.value = true
  error.value = ''
  try {
    await api.saveLinks(props.product.id, next)
    removing.value = false
    emit('saved')
  } catch (e) {
    error.value = t('products.saveFailed')
    const field = (e as { data?: { data?: { field?: string } } }).data?.data?.field
    if (field === 'links') {
      error.value = t('products.linkDeliveryRequired')
    }
    if (field?.includes('.labels.')) {
      form.value?.setErrors([{ name: `labels.${field.split('.').at(-1)}`, message: t('products.linkLabelRequired') }])
    }
  } finally {
    busy.value = false
  }
}
function save() {
  const value = purchasedLinkSchema.parse(state)
  return persist(
    links.value.some((link) => link.id === value.id)
      ? links.value.map((link) => (link.id === value.id ? value : link))
      : [...links.value, value]
  )
}
function move(index: number, offset: number) {
  const next = [...links.value]
  const [link] = next.splice(index, 1)
  next.splice(index + offset, 0, link!)
  return persist(next)
}
function confirmRemove(link: PurchasedLink) {
  selected.value = link
  error.value = ''
  removing.value = true
}
</script>

<template>
  <div class="mt-6 space-y-4 border-t border-default pt-5">
    <div class="flex items-center justify-between gap-3">
      <h3 class="font-semibold">{{ t('products.purchasedLinks') }}</h3>
      <UButton
        v-if="!editing"
        icon="i-lucide-plus"
        variant="outline"
        :disabled="busy || links.length >= 100"
        @click="edit()"
      >
        {{ t('products.addPurchasedLink') }}
      </UButton>
    </div>
    <UAlert v-if="error" color="error" variant="subtle" :title="error" />
    <UForm v-if="editing" ref="form" :schema="schema" :state="state" novalidate class="space-y-4" @submit="save">
      <UFormField name="url" :label="t('products.linkUrl')" :help="t('products.linkAccessHelp')" required>
        <UInput v-model="state.url" type="url" class="w-full" :disabled="busy" />
      </UFormField>
      <UFormField
        v-for="language in languages"
        :key="language"
        :name="`labels.${language}`"
        :label="t('products.linkLabelInLanguage', { language: language === 'en' ? 'English' : 'Nederlands' })"
        required
      >
        <UInput v-model="state.labels[language]" class="w-full" :disabled="busy" />
      </UFormField>
      <p class="text-sm text-muted">{{ t('products.linkSnapshotHelp') }}</p>
      <div class="flex justify-end gap-2">
        <UButton color="neutral" variant="outline" :disabled="busy" @click="emit('cancel')">{{
          t('products.cancel')
        }}</UButton>
        <UButton type="submit" :loading="busy">{{ t('products.save') }}</UButton>
      </div>
    </UForm>
    <ul v-else-if="links.length" class="divide-y divide-default">
      <li v-for="(link, index) in links" :key="link.id" class="flex items-start gap-3 py-3">
        <UIcon name="i-lucide-link" class="mt-1 size-4 shrink-0" />
        <div class="min-w-0 flex-1">
          <a
            :href="link.url"
            target="_blank"
            rel="noopener noreferrer"
            referrerpolicy="no-referrer"
            class="block truncate font-medium hover:underline"
            >{{ name(link) }}</a
          >
          <p class="truncate text-xs text-muted">{{ link.url }}</p>
          <p v-for="language in languages" :key="language" class="text-xs text-muted">
            {{ language.toUpperCase() }}: {{ link.labels[language] }}
          </p>
        </div>
        <div class="flex shrink-0 gap-1">
          <UButton
            icon="i-lucide-arrow-up"
            variant="ghost"
            color="neutral"
            size="xs"
            :aria-label="t('products.moveLinkUp')"
            :disabled="busy || index === 0"
            @click="move(index, -1)"
          />
          <UButton
            icon="i-lucide-arrow-down"
            variant="ghost"
            color="neutral"
            size="xs"
            :aria-label="t('products.moveLinkDown')"
            :disabled="busy || index === links.length - 1"
            @click="move(index, 1)"
          />
          <UButton
            icon="i-lucide-pencil"
            variant="soft"
            color="neutral"
            size="xs"
            :aria-label="t('products.editPurchasedLink')"
            :disabled="busy"
            @click="edit(link)"
          />
          <UButton
            icon="i-lucide-trash-2"
            variant="ghost"
            color="error"
            size="xs"
            :aria-label="t('products.removePurchasedLink')"
            :disabled="busy"
            @click="confirmRemove(link)"
          />
        </div>
      </li>
    </ul>
    <p v-else class="text-sm text-muted">{{ t('products.noPurchasedLinks') }}</p>
    <ConfirmationModal
      v-if="removing"
      v-model:open="removing"
      title="products.removePurchasedLink"
      message="products.removePurchasedLinkConfirm"
      :message-params="{ name: selected ? name(selected) : '' }"
      confirm-text="products.removePurchasedLink"
      confirm-color="error"
      @confirm="persist(links.filter((link) => link.id !== selected?.id))"
    />
  </div>
</template>
