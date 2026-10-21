<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const editorBusy = ref(false)
const section = computed(() =>
  ['order-details', 'checkout-free', 'checkout-paid'].includes(String(route.query.type))
    ? String(route.query.type)
    : 'order-details'
)
const language = computed<'en' | 'nl'>(() => (route.query.locale === 'nl' ? 'nl' : 'en'))
const groups = computed(() => [
  {
    label: t('products.storeTextOrderPages'),
    icon: 'i-lucide-receipt-text',
    items: [{ id: 'order-details', label: t('products.storeTextOrderDetails') }]
  },
  {
    label: t('products.storeTextCheckout'),
    icon: 'i-lucide-message-square-heart',
    items: [
      { id: 'checkout-free', label: t('products.thankYouFree') },
      { id: 'checkout-paid', label: t('products.thankYouPaid') }
    ]
  }
])
const title = computed(
  () => groups.value.flatMap((group) => group.items).find((item) => item.id === section.value)?.label
)
function select(type: string, locale = language.value) {
  return router.replace({ path: '/admin/products/texts', query: { type, locale } })
}
</script>

<template>
  <ProductsShell
    :title="t('products.storeTexts')"
    :subtitle="t('products.storeTextsIntro')"
    icon="i-lucide-text-cursor-input"
  >
    <div class="grid items-start gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <nav class="space-y-5 lg:sticky lg:top-0" :aria-label="t('products.storeTextNavigation')">
        <section v-for="group in groups" :key="group.label" class="space-y-1">
          <h2 class="flex items-center gap-2 px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">
            <UIcon :name="group.icon" class="size-4 shrink-0" />{{ group.label }}
          </h2>
          <UButton
            v-for="item in group.items"
            :key="item.id"
            type="button"
            block
            class="justify-start"
            :label="item.label"
            :color="section === item.id ? 'primary' : 'neutral'"
            :variant="section === item.id ? 'soft' : 'ghost'"
            :aria-current="section === item.id ? 'page' : undefined"
            :disabled="editorBusy"
            @click="select(item.id)"
          />
        </section>
      </nav>
      <div class="min-w-0 space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-lg font-semibold">{{ title }}</h2>
          <div class="flex gap-2" role="group" :aria-label="t('products.thankYouLanguage')">
            <UButton
              v-for="item in [
                { value: 'en' as const, label: 'English' },
                { value: 'nl' as const, label: 'Nederlands' }
              ]"
              :key="item.value"
              type="button"
              :label="item.label"
              :color="language === item.value ? 'primary' : 'neutral'"
              :variant="language === item.value ? 'soft' : 'outline'"
              :aria-pressed="language === item.value"
              :disabled="editorBusy"
              @click="select(section, item.value)"
            />
          </div>
        </div>
        <KeepAlive>
          <ProductsOrderTextEditor v-if="section === 'order-details'" :locale="language" @busy="editorBusy = $event" />
          <ProductsThankYouTextEditor
            v-else
            :locale="language"
            :variant="section === 'checkout-paid' ? 'paid' : 'free'"
            @busy="editorBusy = $event"
          />
        </KeepAlive>
      </div>
    </div>
  </ProductsShell>
</template>
