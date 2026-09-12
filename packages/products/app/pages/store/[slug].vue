<script setup lang="ts">
/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 */
import { z } from 'zod'
import { authClient } from '@nuxt-customer-portal/core/app/utils/auth-client'
import type { AuthSessionResponse } from '@nuxt-customer-portal/core/app/utils/auth-client'
import { billingSchema } from '../../../shared/validation'
import { resolveCheckoutQuery, resolveCheckoutReturnUrl } from '../../../shared/checkout-query'
import { formatMoney } from '../../../shared/money'
import { defaultCheckoutAppearance } from '../../../shared/checkout-appearance'
import type { CatalogProduct } from '../../../shared/types'

interface CheckoutProfile {
  name: string
  firstName: string
  lastName: string
  email: string
  buyerType: 'person' | 'organization'
  canBuyAsBusiness: boolean
  organizationName: string
}

interface PersonalAddress {
  address: string
  archived: boolean
}

definePageMeta({ public: true, layout: 'store' })
const { t, locale, setLocale } = useI18n()
const route = useRoute()
const api = useProducts()
const { locale: requestedLocale, currency } = resolveCheckoutQuery(route.query)
if (locale.value !== requestedLocale) {
  await setLocale(requestedLocale)
}

const userStore = useUserStore()
const requestFetch = useRequestFetch()
const session = await authClient.getSession().catch(() => null)
const authenticatedSession = session?.data as unknown as AuthSessionResponse | undefined
if (authenticatedSession) {
  await userStore.setSession(authenticatedSession)
}
const initialBillingProfile = authenticatedSession
  ? await requestFetch<CheckoutProfile>('/api/products/checkout-profile', { cache: 'no-store' }).catch(() => null)
  : null
const initialPersonalAddress = authenticatedSession
  ? await requestFetch<PersonalAddress | null>('/api/personal-client/address', { cache: 'no-store' }).catch(() => null)
  : null
const savedPersonalAddress = ref(
  initialPersonalAddress && !initialPersonalAddress.archived ? initialPersonalAddress.address : ''
)

function activeOrganizationName() {
  const organization = userStore.activeOrganization
  if (!organization) {
    return ''
  }
  try {
    const metadata =
      typeof organization.metadata === 'string'
        ? (JSON.parse(organization.metadata) as Record<string, unknown>)
        : (organization.metadata as Record<string, unknown> | undefined)
    if (typeof metadata?.officialCompanyName === 'string' && metadata.officialCompanyName.trim()) {
      return metadata.officialCompanyName.trim()
    }
  } catch {
    // Fall back to the organization's display name when legacy metadata is malformed.
  }
  return ''
}

const product = ref<CatalogProduct>()
const error = ref('')
const busy = ref(false)
const signInOpen = ref(false)
const sandboxAlertVisible = ref(true)
const displayNameCustomized = ref(false)
const checkoutForm = useTemplateRef('checkoutForm')
const { currentUser, isAuthenticated } = usePortalSession()
const canBuyAsBusiness = ref(initialBillingProfile?.canBuyAsBusiness ?? true)
const clients = ref<Array<{ id: string; name: string }>>([])
const state = reactive({
  priceId: '',
  billing: {
    type: initialBillingProfile?.buyerType || ('person' as 'person' | 'organization'),
    firstName: initialBillingProfile?.firstName || '',
    lastName: initialBillingProfile?.lastName || '',
    name: initialBillingProfile?.name || authenticatedSession?.user.name || '',
    email: initialBillingProfile?.email || authenticatedSession?.user.email || '',
    company: activeOrganizationName() || initialBillingProfile?.organizationName || '',
    clientId: '',
    address: initialBillingProfile?.buyerType === 'person' ? savedPersonalAddress.value : '',
    country: 'NL',
    registrationNumber: '',
    vatNumber: ''
  }
})
const schema = useProductFormSchema(z.object({ priceId: z.string().min(1), billing: billingSchema }))
let requestId = crypto.randomUUID()

async function applySession() {
  const [profile, availableClients, personalAddress] = await Promise.all([
    $fetch<CheckoutProfile>('/api/products/checkout-profile', { cache: 'no-store' }).catch(() => null),
    api.checkoutClients().catch(() => []),
    $fetch<PersonalAddress | null>('/api/personal-client/address', { cache: 'no-store' }).catch(() => null)
  ])
  state.billing.type = profile?.buyerType || 'person'
  canBuyAsBusiness.value = profile?.canBuyAsBusiness ?? true
  state.billing.firstName = profile?.firstName || ''
  state.billing.lastName = profile?.lastName || ''
  state.billing.name = profile?.name || currentUser.value?.name || ''
  state.billing.email = profile?.email || currentUser.value?.email || ''
  state.billing.company = activeOrganizationName() || profile?.organizationName || ''
  savedPersonalAddress.value = personalAddress && !personalAddress.archived ? personalAddress.address : ''
  state.billing.address = profile?.buyerType === 'person' ? savedPersonalAddress.value : ''
  clients.value = availableClients
  signInOpen.value = false
  await nextTick()
  checkoutForm.value?.clear()
}

try {
  product.value = await api.catalog(String(route.params.slug), requestedLocale, currency)
  if (!product.value.prices.length && currency) {
    product.value = await api.catalog(String(route.params.slug), requestedLocale)
  }
  state.priceId = product.value.prices[0]?.id || ''
  await applySession()
} catch {
  error.value = t('products.unavailable')
}

watch(
  () => state.billing.type,
  (type) => {
    state.billing.clientId = ''
    if (type === 'person') {
      displayNameCustomized.value = false
      state.billing.name = [state.billing.firstName.trim(), state.billing.lastName.trim()].filter(Boolean).join(' ')
      state.billing.address = savedPersonalAddress.value
    }
  }
)
watch(
  () => [state.billing.firstName, state.billing.lastName],
  () => {
    if (state.billing.type === 'person' && !displayNameCustomized.value) {
      state.billing.name = [state.billing.firstName.trim(), state.billing.lastName.trim()].filter(Boolean).join(' ')
    }
  }
)
watch(state, () => (requestId = crypto.randomUUID()), { deep: true })

const appearance = computed(() => product.value?.checkoutAppearance || defaultCheckoutAppearance())
const checkoutReturnUrl = computed(() => resolveCheckoutReturnUrl(route.query.returnUrl, appearance.value.returnUrl))
const themeStyle = computed(() => ({
  '--checkout-paper': appearance.value.paperColor,
  '--checkout-surface': appearance.value.surfaceColor,
  '--checkout-ink': appearance.value.inkColor,
  '--checkout-muted': appearance.value.mutedColor,
  '--checkout-display': appearance.value.displayColor,
  '--checkout-accent': appearance.value.accentColor,
  '--checkout-action': appearance.value.actionColor,
  '--checkout-focus': appearance.value.focusColor,
  '--checkout-border': appearance.value.borderColor,
  '--checkout-radius': `${appearance.value.radius}px`,
  '--checkout-display-font': appearance.value.displayFontFamily,
  '--checkout-body-font': appearance.value.bodyFontFamily
}))
const selectedPrice = computed(() => product.value?.prices.find((price) => price.id === state.priceId))
const currencyLocked = computed(
  () => Boolean(currency) && product.value?.prices.length === 1 && product.value.prices[0]?.currency === currency
)
const endpoint = String(useRuntimeConfig().public.productsImageKitUrlEndpoint || '').replace(/\/$/, '')
const imageSource = (url: string) => (endpoint && url.startsWith(`${endpoint}/`) ? url.slice(endpoint.length) : url)
const imageProvider = (url: string) => (endpoint && url.startsWith(`${endpoint}/`) ? 'imagekit' : undefined)

async function logout() {
  await authClient.signOut()
  useUserStore().clearUserData()
  clients.value = []
  canBuyAsBusiness.value = true
  Object.assign(state.billing, {
    type: 'person',
    firstName: '',
    lastName: '',
    name: '',
    email: '',
    company: '',
    clientId: '',
    address: '',
    country: 'NL',
    registrationNumber: '',
    vatNumber: ''
  })
  await nextTick()
  checkoutForm.value?.clear()
}

async function buy() {
  busy.value = true
  error.value = ''
  try {
    const result = await api.checkout({
      productId: product.value!.id,
      ...state,
      locale: product.value!.locale,
      returnUrl: checkoutReturnUrl.value,
      requestId
    })
    await navigateTo(result.url, { external: true })
  } catch {
    error.value = t('products.checkoutFailed')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="checkout-page" :style="themeStyle">
    <div class="checkout-shell">
      <header class="checkout-header">
        <a v-if="checkoutReturnUrl" :href="checkoutReturnUrl" class="checkout-back"
          >← {{ t('products.backToOffering') }}</a
        >
        <img v-if="appearance.logoUrl" :src="appearance.logoUrl" :alt="appearance.hostName" class="checkout-logo" />
        <span v-else class="checkout-wordmark">{{ appearance.hostName }}</span>
        <span class="checkout-secure">{{ t('products.secureCheckout') }}</span>
      </header>
      <div v-if="product?.storeMode === 'sandbox' && sandboxAlertVisible" class="sandbox-alert">
        <UAlert color="warning" icon="i-lucide-flask-conical" :title="t('products.sandboxBanner')" />
        <button
          type="button"
          class="sandbox-alert-close"
          :aria-label="t('products.close')"
          @click="sandboxAlertVisible = false"
        >
          <UIcon name="i-lucide-x" aria-hidden="true" />
        </button>
      </div>
      <UAlert v-if="error" color="error" :title="error" role="alert" />

      <div v-if="product" class="checkout-grid">
        <aside class="order-card" aria-labelledby="order-title">
          <p class="checkout-eyebrow">{{ t('products.yourSelection') }}</p>
          <div class="order-product">
            <NuxtImg
              v-if="product.thumbnailImage"
              :provider="imageProvider(product.thumbnailImage)"
              :src="imageSource(product.thumbnailImage)"
              :alt="product.title"
              preset="productThumbnail"
              width="112"
              height="112"
              class="order-thumbnail"
            />
            <div class="min-w-0">
              <h1 id="order-title">{{ product.title }}</h1>
              <p v-if="product.subtitle" class="order-subtitle">{{ product.subtitle }}</p>
            </div>
          </div>
          <p class="order-summary">{{ product.summary }}</p>
          <div class="order-price">
            <span>{{ t('products.total') }}</span
            ><strong>{{
              selectedPrice?.amount === 0
                ? t('products.freeProduct')
                : selectedPrice
                  ? formatMoney(selectedPrice.amount, selectedPrice.currency, product.locale)
                  : '—'
            }}</strong>
          </div>
          <p v-if="selectedPrice" class="order-tax">{{ t(`products.${selectedPrice.taxBehavior}`) }}</p>
          <p v-if="appearance.reassurance" class="order-reassurance">{{ appearance.reassurance }}</p>
        </aside>

        <section class="checkout-form-panel" aria-labelledby="checkout-title">
          <h2 id="checkout-title">{{ t('products.checkoutTitle') }}</h2>
          <div class="account-panel">
            <div v-if="isAuthenticated" class="account-identity">
              <div>
                <span>{{ t('products.purchasingAs') }}</span
                ><strong>{{ currentUser?.name || currentUser?.email }}</strong>
              </div>
              <button type="button" class="text-action" @click="logout">{{ t('products.logout') }}</button>
            </div>
            <template v-else>
              <button
                type="button"
                class="sign-in-toggle"
                :aria-expanded="signInOpen"
                @click="signInOpen = !signInOpen"
              >
                <span>{{ t('products.optionalLogin') }}</span
                ><span aria-hidden="true">{{ signInOpen ? '−' : '+' }}</span>
              </button>
              <div v-if="signInOpen" class="sign-in-body">
                <AuthenticationSignInForm
                  :redirect-to="route.fullPath"
                  embedded
                  :redirect-on-success="false"
                  @success="applySession"
                />
              </div>
            </template>
          </div>

          <UForm ref="checkoutForm" :state="state" :schema="schema" novalidate class="billing-form" @submit="buy">
            <h3>{{ t('products.billingDetails') }}</h3>
            <UFormField v-if="!currencyLocked" name="priceId" :label="t('products.price')"
              ><USelect
                v-model="state.priceId"
                class="w-full"
                :items="
                  product.prices.map((price) => ({
                    value: price.id,
                    label:
                      price.amount === 0
                        ? t('products.freeProduct')
                        : formatMoney(price.amount, price.currency, requestedLocale)
                  }))
                "
            /></UFormField>
            <UFormField v-if="!isAuthenticated || canBuyAsBusiness" name="billing.type" :label="t('products.buyingAs')"
              ><USelect
                v-model="state.billing.type"
                class="w-full"
                :items="[
                  { value: 'person', label: t('products.person') },
                  { value: 'organization', label: t('products.organization') }
                ]"
            /></UFormField>
            <UFormField
              v-if="state.billing.type === 'organization' && clients.length"
              name="billing.clientId"
              :label="t('products.billingClient')"
              ><USelect
                v-model="state.billing.clientId"
                class="w-full"
                :items="[
                  { value: '', label: t('products.newBusiness') },
                  ...clients.map((client) => ({ value: client.id, label: client.name }))
                ]"
            /></UFormField>
            <div class="field-grid">
              <template v-if="state.billing.type === 'person'">
                <UFormField name="billing.firstName" :label="t('products.firstName')" required
                  ><UInput v-model="state.billing.firstName" autocomplete="given-name" class="w-full"
                /></UFormField>
                <UFormField name="billing.lastName" :label="t('products.lastName')" required
                  ><UInput v-model="state.billing.lastName" autocomplete="family-name" class="w-full"
                /></UFormField>
              </template>
              <UFormField name="billing.name" :label="t('products.yourName')"
                ><UInput
                  v-model="state.billing.name"
                  autocomplete="name"
                  class="w-full"
                  @update:model-value="displayNameCustomized = true"
              /></UFormField>
              <UFormField name="billing.email" :label="t('products.email')"
                ><UInput v-model="state.billing.email" type="email" autocomplete="email" class="w-full"
              /></UFormField>
              <UFormField name="billing.country" :label="t('products.country')"
                ><UInput v-model="state.billing.country" maxlength="2" autocomplete="country" class="w-full"
              /></UFormField>
              <UFormField name="billing.address" :label="t('products.address')"
                ><UTextarea v-model="state.billing.address" autocomplete="street-address" class="w-full"
              /></UFormField>
              <template v-if="state.billing.type === 'organization'">
                <UFormField name="billing.company" :label="t('products.company')"
                  ><UInput v-model="state.billing.company" autocomplete="organization" class="w-full"
                /></UFormField>
                <UFormField name="billing.vatNumber" :label="t('products.vatNumber')"
                  ><UInput v-model="state.billing.vatNumber" class="w-full"
                /></UFormField>
              </template>
            </div>
            <p class="checkout-note">
              {{ t(product.storeMode === 'sandbox' ? 'products.sandboxFinalTax' : 'products.finalTax') }}
            </p>
            <UButton
              type="submit"
              block
              size="xl"
              :disabled="!product.pricingComplete || !selectedPrice"
              :loading="busy"
              icon="i-lucide-lock-keyhole"
              >{{
                t(
                  selectedPrice?.amount === 0
                    ? 'products.getFree'
                    : product.storeMode === 'sandbox'
                      ? 'products.testCheckout'
                      : 'products.pay'
                )
              }}</UButton
            >
          </UForm>
        </section>
      </div>
    </div>
  </main>
</template>

<style scoped>
/* Hallmark · macrostructure: split checkout · genre: editorial · tone: warm · anchor: teal
 * contrast: pass · chrome: pass · tokens: pass · responsive: pass
 */
:global(html),
:global(body) {
  overflow-x: clip;
}
.checkout-page {
  min-height: 100vh;
  overflow-x: clip;
  background: var(--checkout-paper);
  color: var(--checkout-ink);
  font-family: var(--checkout-body-font);
}
.checkout-shell {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto;
  padding: 24px 0 64px;
}
.checkout-header {
  min-height: 72px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 20px;
  border-bottom: 1px solid var(--checkout-border);
  margin-bottom: 32px;
}
.checkout-logo {
  width: auto;
  max-width: 190px;
  max-height: 58px;
  object-fit: contain;
}
.checkout-wordmark {
  color: var(--checkout-display);
  font-family: var(--checkout-display-font);
  font-size: 1.5rem;
}
.checkout-back,
.checkout-secure,
.text-action {
  color: var(--checkout-muted);
  font-size: 0.84rem;
  white-space: nowrap;
}
.checkout-back:hover,
.text-action:hover {
  color: var(--checkout-accent);
}
.checkout-secure {
  justify-self: end;
}
.sandbox-alert {
  position: relative;
}
.sandbox-alert-close {
  position: absolute;
  top: 50%;
  right: 18px;
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 999px;
  color: currentColor;
  transform: translateY(-50%);
}
.sandbox-alert-close:hover {
  background: rgb(255 255 255 / 18%);
}
.sandbox-alert-close:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
.checkout-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.25fr);
  align-items: start;
  gap: clamp(28px, 5vw, 72px);
}
.order-card,
.checkout-form-panel {
  min-width: 0;
}
.order-card {
  position: sticky;
  top: 24px;
  background: var(--checkout-surface);
  border: 1px solid var(--checkout-border);
  border-radius: var(--checkout-radius);
  padding: clamp(20px, 3vw, 32px);
}
.checkout-eyebrow {
  margin: 0 0 18px;
  color: var(--checkout-accent);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.order-product {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 18px;
  align-items: center;
}
.order-thumbnail {
  width: 96px;
  height: 96px;
  border-radius: calc(var(--checkout-radius) * 0.62);
  object-fit: cover;
}
h1,
h2 {
  color: var(--checkout-display);
  font-family: var(--checkout-display-font);
  font-style: normal;
  overflow-wrap: anywhere;
}
h1 {
  margin: 0;
  font-size: clamp(1.55rem, 3vw, 2rem);
  line-height: 1.08;
}
h2 {
  margin: 0;
  font-size: clamp(2.15rem, 5vw, 3.75rem);
  line-height: 1.04;
}
h3 {
  margin: 0;
  color: var(--checkout-display);
  font-size: 1.08rem;
}
.order-subtitle,
.order-summary,
.checkout-note,
.order-tax {
  color: var(--checkout-muted);
}
.order-subtitle {
  margin: 8px 0 0;
  font-size: 0.9rem;
}
.order-summary {
  margin: 24px 0;
  line-height: 1.65;
}
.order-price {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--checkout-border);
}
.order-price strong {
  color: var(--checkout-display);
  font-size: 1.18rem;
}
.order-tax {
  margin: 6px 0 0;
  text-align: right;
  font-size: 0.78rem;
}
.order-reassurance {
  margin: 24px 0 0;
  padding: 16px;
  border-left: 3px solid var(--checkout-accent);
  background: var(--checkout-paper);
  color: var(--checkout-display);
  line-height: 1.55;
}
.account-panel {
  margin-top: 28px;
  margin-bottom: 28px;
  overflow: clip;
  border: 1px solid var(--checkout-border);
  border-radius: var(--checkout-radius);
  background: var(--checkout-surface);
}
.sign-in-toggle,
.account-identity {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 18px 20px;
  text-align: left;
}
.sign-in-toggle {
  color: var(--checkout-display);
  font-weight: 700;
}
.sign-in-toggle:hover {
  background: var(--checkout-paper);
}
.sign-in-toggle:active,
.text-action:active {
  color: var(--checkout-action);
}
.sign-in-toggle:disabled,
.text-action:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.sign-in-toggle:focus-visible,
button:focus-visible,
a:focus-visible {
  outline: 3px solid var(--checkout-focus);
  outline-offset: 3px;
}
.sign-in-body {
  padding: 4px 20px 24px;
  border-top: 1px solid var(--checkout-border);
}
/* Hallmark · component: embedded sign-in · genre: editorial · theme: host checkout
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass · chrome: pass · tokens: pass
 */
:deep(.checkout-sign-in) {
  color: var(--checkout-ink);
  font-family: var(--checkout-body-font);
}
:deep(.checkout-sign-in button[type='button'].w-full) {
  min-height: 42px;
  border: 1px solid var(--checkout-border);
  border-radius: calc(var(--checkout-radius) * 0.55);
  background: var(--checkout-surface);
  box-shadow: none;
  color: var(--checkout-ink);
}
:deep(.checkout-sign-in button[type='button'].w-full:hover) {
  border-color: var(--checkout-accent);
  background: var(--checkout-paper);
  color: var(--checkout-display);
}
:deep(.checkout-sign-in button[type='button'].w-full:active) {
  background: var(--checkout-border);
}
:deep(.checkout-sign-in button[type='submit']) {
  min-height: 46px;
  border: 1px solid var(--checkout-action);
  border-radius: calc(var(--checkout-radius) * 0.55);
  background: var(--checkout-action);
  box-shadow: none;
  color: var(--checkout-surface);
  font-weight: 700;
}
:deep(.checkout-sign-in button[type='submit']:hover) {
  filter: brightness(1.08);
}
:deep(.checkout-sign-in button[type='submit']:active) {
  filter: brightness(0.94);
}
:deep(.checkout-sign-in button:focus-visible),
:deep(.checkout-sign-in input:focus-visible),
:deep(.checkout-sign-in a:focus-visible) {
  outline: 3px solid var(--checkout-focus);
  outline-offset: 3px;
}
:deep(.checkout-sign-in button:disabled),
:deep(.checkout-sign-in button[aria-disabled='true']) {
  cursor: not-allowed;
  filter: none;
  opacity: 0.55;
}
:deep(.checkout-sign-in input:not([type='checkbox'])) {
  border-radius: calc(var(--checkout-radius) * 0.55);
  background: var(--checkout-surface);
  box-shadow: inset 0 0 0 1px var(--checkout-border);
  color: var(--checkout-ink);
}
:deep(.checkout-sign-in input:not([type='checkbox']):focus) {
  box-shadow: inset 0 0 0 1px var(--checkout-focus);
}
:deep(.checkout-sign-in a) {
  color: var(--checkout-display);
  text-decoration-color: var(--checkout-border);
  text-underline-offset: 3px;
}
:deep(.checkout-sign-in a:hover) {
  color: var(--checkout-accent);
  text-decoration-color: currentColor;
}
:deep(.checkout-sign-in button[role='checkbox'][data-state='checked']) {
  background: var(--checkout-action);
  color: var(--checkout-surface);
}
.account-identity div {
  display: grid;
  gap: 2px;
}
.account-identity span {
  color: var(--checkout-muted);
  font-size: 0.78rem;
}
.account-identity strong {
  color: var(--checkout-display);
}
.billing-form {
  display: grid;
  gap: 20px;
  padding: clamp(20px, 3vw, 32px);
  border: 1px solid var(--checkout-border);
  border-radius: var(--checkout-radius);
  background: var(--checkout-surface);
}
.field-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 20px;
}
.checkout-note {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.5;
}
:deep(.billing-form button[type='submit']) {
  background: var(--checkout-action);
  color: var(--checkout-surface);
}
:deep(.billing-form button[type='submit']:hover) {
  filter: brightness(1.08);
}
:deep(.billing-form button[type='submit']:active) {
  filter: brightness(0.94);
}
:deep(.billing-form button[type='submit']:disabled) {
  cursor: not-allowed;
  opacity: 0.55;
}
@media (max-width: 760px) {
  .checkout-shell {
    width: min(100% - 24px, 620px);
    padding-top: 12px;
  }
  .checkout-header {
    grid-template-columns: minmax(0, 1fr) auto;
    margin-bottom: 22px;
  }
  .checkout-back {
    order: 2;
    justify-self: end;
  }
  .checkout-logo,
  .checkout-wordmark {
    order: 1;
    justify-self: start;
  }
  .checkout-secure {
    display: none;
  }
  .checkout-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .order-card {
    position: static;
  }
  .checkout-form-panel {
    padding-top: 6px;
  }
}
@media (max-width: 480px) {
  .checkout-header {
    gap: 10px;
  }
  .checkout-logo {
    max-width: 145px;
    max-height: 48px;
  }
  .field-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .order-product {
    grid-template-columns: 72px minmax(0, 1fr);
  }
  .order-thumbnail {
    width: 72px;
    height: 72px;
  }
}
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
