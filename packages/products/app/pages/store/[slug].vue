<script setup lang="ts">
import { countryCodes } from '../../../shared/countries'
/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 */
import { z } from 'zod'
import { formatAppointmentRange } from '@nuxt-customer-portal/core/shared/appointment-time'
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
  country: string | null
  buyerType: 'person' | 'organization'
  canBuyAsBusiness: boolean
  organizationName: string
}

interface PersonalAddress {
  address: string
  archived: boolean
}

definePageMeta({ public: true, layout: 'store', key: (route) => `checkout:${route.path}` })
const { t, locale, setLocale } = useI18n()
const route = useRoute()
const browserDateLocale = ref<string[]>()
onMounted(() => {
  browserDateLocale.value = [...navigator.languages]
})
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
const holdToken = typeof route.query.holdToken === 'string' ? route.query.holdToken : undefined
const hold = ref<{
  productId: string
  start: string
  end: string
  expiresAt: string
  providerName: string
  amount: number
  currency: string
  customerTimezone: string
}>()
const holdExpired = ref(false)
const holdNow = ref(Date.now())
const reservationCountdown = computed(() => {
  const seconds = Math.max(0, Math.ceil((Date.parse(hold.value?.expiresAt ?? '') - holdNow.value) / 1000))
  if (!Number.isFinite(seconds)) {
    return '00:00'
  }
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
})
const bookingDate = computed(() =>
  hold.value
    ? new Intl.DateTimeFormat(browserDateLocale.value, {
        dateStyle: 'long',
        timeZone: hold.value.customerTimezone
      }).format(new Date(hold.value.start))
    : ''
)
const bookingTimeRange = computed(() => {
  if (!hold.value) {
    return ''
  }
  return formatAppointmentRange(hold.value.start, hold.value.end, {
    locale: browserDateLocale.value,
    timeZone: hold.value.customerTimezone,
    midnight: t('products.midnight'),
    includeDate: false
  })
})
let holdTimer: ReturnType<typeof setInterval> | undefined
if (holdToken) {
  try {
    hold.value = await requestFetch('/api/store/planning/hold', { query: { holdToken }, cache: 'no-store' })
  } catch {
    holdExpired.value = true
  }
}
onMounted(() => {
  if (hold.value) {
    holdNow.value = Date.now()
    holdExpired.value = Date.parse(hold.value.expiresAt) <= holdNow.value
    holdTimer = setInterval(() => {
      holdNow.value = Date.now()
      holdExpired.value = Date.parse(hold.value!.expiresAt) <= holdNow.value
    }, 1000)
  }
})
onUnmounted(() => {
  if (holdTimer) {
    clearInterval(holdTimer)
  }
})
useHead({ meta: [{ name: 'referrer', content: 'no-referrer' }] })
const error = ref('')
const busy = ref(false)
const releasingHold = ref(false)
async function backToTimeSelection() {
  if (releasingHold.value || !holdToken || !product.value) {
    return
  }
  releasingHold.value = true
  error.value = ''
  try {
    await $fetch('/api/store/planning/hold', { method: 'DELETE', body: { holdToken } })
    sessionStorage.removeItem(`planning-hold:${product.value.id}`)
    await navigateTo({
      path:
        typeof route.query.appointmentId === 'string'
          ? `/appointments/${encodeURIComponent(route.query.appointmentId)}`
          : `/store/${encodeURIComponent(product.value.slug)}/book`,
      query: { locale: product.value.locale, currency, returnUrl: checkoutReturnUrl.value || undefined }
    })
  } catch {
    error.value = t('products.reservationReleaseFailed')
  } finally {
    releasingHold.value = false
  }
}
const signInOpen = ref(false)
const displayNameCustomized = ref(false)
const checkoutForm = useTemplateRef('checkoutForm')
const { currentUser, isAuthenticated } = usePortalSession()
const canBuyAsBusiness = ref(initialBillingProfile?.canBuyAsBusiness ?? true)
function toggleBuyerType() {
  state.billing.type = state.billing.type === 'person' ? 'organization' : 'person'
}
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
    country:
      initialBillingProfile?.country && countryCodes.includes(initialBillingProfile.country)
        ? initialBillingProfile.country
        : '',
    registrationNumber: '',
    vatNumber: ''
  }
})
const countryOptions = computed(() => {
  const names = new Intl.DisplayNames(locale.value, { type: 'region' })
  return countryCodes
    .map((value) => ({ value, label: `${names.of(value) || value} (${value})` }))
    .sort((a, b) => a.label.localeCompare(b.label, locale.value))
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
  state.billing.country = profile?.country && countryCodes.includes(profile.country) ? profile.country : ''
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
  if (product.value.planningEnabled && !holdToken) {
    await navigateTo({ path: `/store/${encodeURIComponent(product.value.slug)}/book`, query: route.query })
  }
  if (hold.value && hold.value.productId !== product.value.id) {
    hold.value = undefined
    holdExpired.value = true
  }
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
const selectedPrice = computed(() => {
  const price = product.value?.prices.find((price) => price.id === state.priceId)
  return price && hold.value ? { ...price, amount: hold.value.amount, currency: hold.value.currency } : price
})
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
    country: '',
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
      requestId,
      holdToken
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
        <button
          v-if="hold && product"
          type="button"
          :disabled="releasingHold"
          class="checkout-back"
          @click="backToTimeSelection"
        >
          ← {{ t('products.backToTimeSelection') }}
        </button>
        <a v-else-if="checkoutReturnUrl" :href="checkoutReturnUrl" class="checkout-back"
          >← {{ t('products.backToOffering') }}</a
        >
        <img v-if="appearance.logoUrl" :src="appearance.logoUrl" :alt="appearance.hostName" class="checkout-logo" />
        <span v-else class="checkout-wordmark">{{ appearance.hostName }}</span>
        <span class="checkout-secure" :class="{ 'checkout-test': product?.storeMode === 'sandbox' }">{{
          t(product?.storeMode === 'sandbox' ? 'products.testCheckoutLabel' : 'products.secureCheckout')
        }}</span>
      </header>
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
          <div v-if="hold" class="booking-summary">
            <div class="booking-summary-row">
              <UIcon name="i-lucide-calendar-days" aria-hidden="true" />
              <p>{{ bookingDate }}</p>
            </div>
            <div class="booking-summary-row booking-summary-time">
              <UIcon name="i-lucide-clock" aria-hidden="true" />
              <p>{{ bookingTimeRange }}</p>
            </div>
            <div class="booking-summary-row booking-summary-provider">
              <UIcon name="i-lucide-user-round" aria-hidden="true" />
              <p>{{ hold.providerName }}</p>
            </div>
            <div class="booking-reservation" :class="{ 'booking-reservation-expired': holdExpired }">
              <span>{{ t('products.reservationRemaining') }}</span>
              <span class="booking-countdown" role="timer" aria-live="off">
                <UIcon name="i-lucide-timer" aria-hidden="true" />
                {{ reservationCountdown }}
              </span>
            </div>
          </div>
          <div v-if="holdExpired" class="reservation-expired" role="alert">
            <div class="reservation-expired-heading">
              <UIcon name="i-lucide-calendar-clock" aria-hidden="true" />
              <strong>{{ t('products.reservationExpiredTitle') }}</strong>
            </div>
            <p>{{ t('products.reservationExpiredDescription') }}</p>
            <UButton
              :to="{
                path:
                  typeof route.query.appointmentId === 'string'
                    ? `/appointments/${encodeURIComponent(route.query.appointmentId)}`
                    : `/store/${encodeURIComponent(product.slug)}/book`,
                query: { locale: product.locale, currency, returnUrl: checkoutReturnUrl || undefined }
              }"
              color="neutral"
              variant="outline"
              icon="i-lucide-arrow-left"
              >{{ t('products.chooseAnotherSlot') }}</UButton
            >
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
            <UFormField v-if="!currencyLocked && !hold" name="priceId" :label="t('products.price')"
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
            <UFormField v-if="isAuthenticated && canBuyAsBusiness" name="billing.type" :label="t('products.buyingAs')"
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
                  ><UInput v-model="state.billing.firstName" autocomplete="given-name" autofocus class="w-full"
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
              <UFormField name="billing.address" :label="t('products.address')" class="col-span-full"
                ><UTextarea v-model="state.billing.address" autocomplete="street-address" class="w-full"
              /></UFormField>
              <UFormField name="billing.country" :label="t('products.country')" class="col-span-full"
                ><USelectMenu
                  v-model="state.billing.country"
                  :items="countryOptions"
                  value-key="value"
                  :placeholder="t('products.selectCountry')"
                  class="w-full"
              /></UFormField>
              <div v-if="!isAuthenticated" class="col-span-full">
                <UButton
                  v-if="state.billing.type === 'person'"
                  type="button"
                  color="neutral"
                  variant="link"
                  class="buyer-type-link text-sm p-0"
                  @click="toggleBuyerType"
                  >{{ t('products.buyingAsCompany') }}</UButton
                >
                <UButton
                  v-else
                  type="button"
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-arrow-left"
                  class="cursor-pointer"
                  @click="toggleBuyerType"
                  >{{ t('products.switchToPrivatePurchase') }}</UButton
                >
              </div>
              <template v-if="state.billing.type === 'organization'">
                <UFormField name="billing.company" :label="t('products.company')"
                  ><UInput v-model="state.billing.company" autocomplete="organization" class="w-full"
                /></UFormField>
                <UFormField name="billing.vatNumber" :label="t('products.vatNumber')"
                  ><UInput v-model="state.billing.vatNumber" class="w-full"
                /></UFormField>
              </template>
            </div>
            <p v-if="product.storeMode !== 'sandbox'" class="checkout-note">
              {{ t('products.finalTax') }}
            </p>
            <UButton
              type="submit"
              block
              size="xl"
              :disabled="
                !product.pricingComplete || !selectedPrice || holdExpired || (product.planningEnabled && !hold)
              "
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

<style scoped src="../../assets/css/checkout.css"></style>
