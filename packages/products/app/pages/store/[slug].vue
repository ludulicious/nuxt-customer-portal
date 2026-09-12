<script setup lang="ts">
import { z } from 'zod'
import { billingSchema } from '../../../shared/validation'
import { formatMoney } from '../../../shared/money'
import type { CatalogProduct } from '../../../shared/types'

definePageMeta({ public: true, layout: 'store' })
const { t, locale } = useI18n(),
  route = useRoute(),
  api = useProducts(),
  product = ref<CatalogProduct>(),
  error = ref(''),
  busy = ref(false)
const { currentUser, isAuthenticated } = usePortalSession()
const clients = ref<Array<{ id: string; name: string }>>([])
const state = reactive({
  priceId: '',
  billing: {
    type: 'person' as 'person' | 'organization',
    name: '',
    email: '',
    company: '',
    clientId: '',
    address: '',
    country: 'NL',
    registrationNumber: '',
    vatNumber: ''
  }
})
const schema = useProductFormSchema(z.object({ priceId: z.string().min(1), billing: billingSchema }))
let requestId = ''
onMounted(async () => {
  requestId = crypto.randomUUID()
  if (currentUser.value) {
    state.billing.name = currentUser.value.name || ''
    state.billing.email = currentUser.value.email || ''
    clients.value = await api.checkoutClients().catch(() => [])
  }
  try {
    product.value = await api.catalog(String(route.params.slug), locale.value)
    state.priceId = product.value.prices[0]?.id || ''
  } catch {
    error.value = t('products.unavailable')
  }
})
watch(
  () => state.billing.type,
  () => {
    state.billing.clientId = ''
  }
)
watch(
  state,
  () => {
    requestId = crypto.randomUUID()
  },
  { deep: true }
)
async function buy() {
  busy.value = true
  error.value = ''
  try {
    const result = await api.checkout({ productId: product.value!.id, ...state, locale: locale.value, requestId })
    await navigateTo(result.url, { external: true })
  } catch {
    error.value = t('products.checkoutFailed')
  } finally {
    busy.value = false
  }
}
const canRegister = useRuntimeConfig().public.portalAuth.registrationMode === 'open'
const imageKitEndpoint = String(useRuntimeConfig().public.productsImageKitUrlEndpoint || '').replace(/\/$/, '')
const imageSource = (url: string) =>
  imageKitEndpoint && url.startsWith(`${imageKitEndpoint}/`) ? url.slice(imageKitEndpoint.length) : url
const imageProvider = (url: string) =>
  imageKitEndpoint && url.startsWith(`${imageKitEndpoint}/`) ? 'imagekit' : undefined
const loginUrl = computed(() => `/login?redirect=${encodeURIComponent(route.fullPath)}`)
</script>

<template>
  <main class="mx-auto max-w-4xl space-y-6 p-6">
    <UAlert
      v-if="product?.storeMode === 'sandbox'"
      color="warning"
      icon="i-lucide-flask-conical"
      :title="t('products.sandboxBanner')"
      :description="t('products.sandboxBannerHelp')"
    />
    <UAlert v-if="error" color="error" :title="error" /><template v-if="product"
      ><h1 class="text-3xl font-semibold">{{ product.title }}</h1>
      <p v-if="product.subtitle" class="text-lg text-muted">{{ product.subtitle }}</p>
      <ProductsMarkdown :html="product.summaryHtml" :theme="product.markdownStyle" />
      <div class="grid gap-3 sm:grid-cols-2">
        <NuxtImg
          v-for="image in product.images"
          :key="image"
          :provider="imageProvider(image)"
          :src="imageSource(image)"
          :alt="product.title"
          preset="productGallery"
          :width="product.imagePolicy.gallery.width"
          :height="product.imagePolicy.gallery.height"
          sizes="sm:100vw md:50vw lg:640px"
          class="w-full rounded-lg"
          loading="lazy"
        />
      </div>
      <ProductsMarkdown :html="product.descriptionHtml" :theme="product.markdownStyle" />
      <div v-if="product.detailImages.length" class="grid gap-3 sm:grid-cols-2">
        <NuxtImg
          v-for="image in product.detailImages"
          :key="`detail-${image}`"
          :provider="imageProvider(image)"
          :src="imageSource(image)"
          :alt="product.title"
          preset="productGallery"
          :width="product.imagePolicy.detail.width"
          :height="product.imagePolicy.detail.height"
          sizes="sm:100vw md:50vw lg:640px"
          class="w-full rounded-lg"
          loading="lazy"
        />
      </div>
      <UButton v-if="product.videoUrl" :to="product.videoUrl" target="_blank" variant="outline" icon="i-lucide-play">{{
        t('products.watchPreview')
      }}</UButton
      ><UForm :state="state" :schema="schema" novalidate class="space-y-4 rounded-lg border p-5" @submit="buy"
        ><div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-xl font-semibold">{{ t('products.checkout') }}</h2>
          <UButton v-if="!isAuthenticated" :to="loginUrl" variant="ghost">{{ t('products.optionalLogin') }}</UButton>
        </div>
        <p class="text-sm text-muted">{{
          t(product.storeMode === 'sandbox' ? 'products.sandboxPurchaseHelp' : 'products.inviteAfterPurchase')
        }}</p>
        <UButton v-if="canRegister && !isAuthenticated" to="/signup" variant="link">{{
          t('products.createAccount')
        }}</UButton>
        <UFormField name="priceId" :label="t('products.price')"
          ><USelect
            v-model="state.priceId"
            class="w-full"
            :items="
              product.prices.map((p) => ({
                value: p.id,
                label:
                  p.amount === 0
                    ? t('products.freeProduct')
                    : `${formatMoney(p.amount, p.currency, locale)} · ${t(`products.${p.taxBehavior}`)}`
              }))
            " /></UFormField
        ><UFormField name="billing.type" :label="t('products.buyingAs')"
          ><USelect
            v-model="state.billing.type"
            :items="[
              { value: 'person', label: t('products.person') },
              { value: 'organization', label: t('products.organization') }
            ]"
        /></UFormField>
        <UFormField
          v-if="state.billing.type === 'organization' && clients.length"
          name="billing.clientId"
          :label="t('products.billingClient')"
        >
          <USelect
            v-model="state.billing.clientId"
            :items="[
              { value: '', label: t('products.newBusiness') },
              ...clients.map((client) => ({ value: client.id, label: client.name }))
            ]"
            class="w-full"
          />
        </UFormField>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField name="billing.name" :label="t('products.yourName')"
            ><UInput v-model="state.billing.name" autocomplete="name" class="w-full" /></UFormField
          ><UFormField name="billing.email" :label="t('products.email')"
            ><UInput v-model="state.billing.email" autocomplete="email" class="w-full" /></UFormField
          ><UFormField name="billing.country" :label="t('products.country')"
            ><UInput v-model="state.billing.country" maxlength="2" class="w-full" /></UFormField
          ><UFormField name="billing.address" :label="t('products.address')"
            ><UTextarea v-model="state.billing.address" autocomplete="street-address" class="w-full" /></UFormField
          ><template v-if="state.billing.type === 'organization'"
            ><UFormField name="billing.company" :label="t('products.company')"
              ><UInput v-model="state.billing.company" autocomplete="organization" class="w-full" /></UFormField
            ><UFormField name="billing.registrationNumber" :label="t('products.registration')"
              ><UInput v-model="state.billing.registrationNumber" class="w-full" /></UFormField
            ><UFormField name="billing.vatNumber" :label="t('products.vatNumber')"
              ><UInput v-model="state.billing.vatNumber" class="w-full" /></UFormField
          ></template>
        </div>
        <p v-if="!product.isFree" class="text-sm text-muted">{{
          t(product.storeMode === 'sandbox' ? 'products.sandboxFinalTax' : 'products.finalTax')
        }}</p>
        <UAlert v-if="!product.pricingComplete" color="warning" :title="t('products.unavailable')" />
        <UButton type="submit" :disabled="!product.pricingComplete" :loading="busy" icon="i-lucide-lock-keyhole">{{
          t(
            product.prices.find((p) => p.id === state.priceId)?.amount === 0
              ? 'products.getFree'
              : product.storeMode === 'sandbox'
                ? 'products.testCheckout'
                : 'products.pay'
          )
        }}</UButton></UForm
      ></template
    >
  </main>
</template>
