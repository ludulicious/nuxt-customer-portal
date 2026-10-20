<script setup lang="ts">
import { z } from 'zod'
import type { Product, ProductOffer } from '../../shared/types'
import { localOfferTimestamp } from '../../shared/offers'
import { currencyScale, formatMoney } from '../../shared/money'

const props = defineProps<{ product: Product; currencies: string[]; disabled?: boolean }>()
const emit = defineEmits<{ saved: [] }>()
const { t, locale } = useI18n()
const api = useProducts()
const editing = ref(false)
const selectedId = ref<string>()
const busy = ref(false)
const error = ref('')
const now = ref(Date.now())
const timezone = ref('')
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timezone.value = Intl.DateTimeFormat().resolvedOptions().timeZone
  now.value = Date.now()
  timer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})
onBeforeUnmount(() => {
  if (timer) {
    clearInterval(timer)
  }
})
const state = reactive({ startsAt: '', endsAt: '', isFree: false, amounts: {} as Record<string, number> })
const schema = computed(() =>
  z
    .object({
      startsAt: z.string().refine((v) => !!localOfferTimestamp(v), t('products.offers.invalidTime')),
      endsAt: z.string().refine((v) => !!localOfferTimestamp(v), t('products.offers.invalidTime')),
      isFree: z.boolean(),
      amounts: z.record(z.string(), z.number())
    })
    .superRefine((value, ctx) => {
      const start = localOfferTimestamp(value.startsAt),
        end = localOfferTimestamp(value.endsAt)
      if (start && end && (Date.parse(end) <= Date.parse(start) || Date.parse(end) <= Date.now())) {
        ctx.addIssue({ code: 'custom', path: ['endsAt'], message: t('products.offers.invalidEnd') })
      }
      if (!value.isFree) {
        for (const currency of props.currencies) {
          const amount = value.amounts[currency]
          const minor = Math.round((amount ?? -1) * currencyScale(currency))
          const regular = props.product.prices.find((p) => p.currency === currency)?.amount ?? 0
          if (
            !Number.isFinite(amount) ||
            minor < 0 ||
            minor >= regular ||
            minor > 100000000 ||
            Math.abs(amount! * currencyScale(currency) - minor) > 0.000001
          ) {
            ctx.addIssue({ code: 'custom', path: ['amounts', currency], message: t('products.offers.invalidPrice') })
          }
        }
      }
    })
)
function localInput(value: string) {
  const date = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
function open(offer?: ProductOffer) {
  selectedId.value = offer?.id
  state.startsAt = offer ? localInput(offer.startsAt) : ''
  state.endsAt = offer ? localInput(offer.endsAt) : ''
  state.isFree = offer?.isFree ?? false
  state.amounts = Object.fromEntries(
    props.currencies.map((currency) => [
      currency,
      (offer?.prices.find((p) => p.currency === currency)?.amount ?? 0) / currencyScale(currency)
    ])
  )
  error.value = ''
  editing.value = true
}
function status(offer: ProductOffer) {
  return !offer.enabled
    ? 'cancelled'
    : now.value >= Date.parse(offer.endsAt)
      ? 'ended'
      : now.value < Date.parse(offer.startsAt)
        ? 'scheduled'
        : 'active'
}
function dateLabel(value: string) {
  return new Date(value).toLocaleString(locale.value, {
    timeZone: timezone.value || 'UTC',
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}
function errorMessage(cause: unknown) {
  const value = cause as { data?: { message?: string }; message?: string }
  return value.data?.message || value.message || t('products.offers.saveFailed')
}
async function save() {
  busy.value = true
  error.value = ''
  try {
    await api.saveOffer(
      props.product.id,
      {
        startsAt: localOfferTimestamp(state.startsAt)!,
        endsAt: localOfferTimestamp(state.endsAt)!,
        isFree: state.isFree,
        prices: state.isFree
          ? []
          : props.currencies.map((currency) => ({
              currency,
              amount: Math.round(state.amounts[currency]! * currencyScale(currency)),
              taxBehavior: props.product.prices.find((p) => p.currency === currency)?.taxBehavior || 'inclusive'
            }))
      },
      selectedId.value
    )
    editing.value = false
    emit('saved')
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    busy.value = false
  }
}
async function cancel(offer: ProductOffer) {
  busy.value = true
  error.value = ''
  try {
    await api.cancelOffer(props.product.id, offer.id)
    emit('saved')
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-semibold">{{ t('products.offers.title') }}</h2>
        <UButton
          v-if="!editing"
          icon="i-lucide-plus"
          color="neutral"
          variant="soft"
          :disabled="disabled || busy || !!product.isFree"
          @click="open()"
          >{{ t('products.offers.add') }}</UButton
        >
      </div>
    </template>
    <p class="mb-4 text-sm text-muted">{{ t('products.offers.description') }}</p>
    <p v-if="timezone" class="mb-4 text-sm text-muted">{{ t('products.offers.timezone', { timezone }) }}</p>
    <p v-if="product.isFree" class="mb-4 text-sm text-muted">{{ t('products.offers.regularFree') }}</p>
    <UAlert v-if="error" color="error" :title="error" class="mb-4" />
    <UForm v-if="editing" :schema="schema" :state="state" novalidate class="mb-6 space-y-4" @submit="save">
      <UFormField name="startsAt" :label="t('products.offers.startsAt')" required>
        <UInput v-model="state.startsAt" type="datetime-local" :disabled="busy" class="w-full" />
      </UFormField>
      <UFormField name="endsAt" :label="t('products.offers.endsAt')" :help="t('products.offers.endHelp')" required>
        <UInput v-model="state.endsAt" type="datetime-local" :disabled="busy" class="w-full" />
      </UFormField>
      <UFormField name="isFree" :label="t('products.offers.free')">
        <USwitch v-model="state.isFree" :disabled="busy" />
      </UFormField>
      <template v-if="!state.isFree">
        <UFormField
          v-for="currency in currencies"
          :key="currency"
          :name="`amounts.${currency}`"
          :label="currency"
          :help="
            t('products.offers.regularPrice', {
              amount: formatMoney(product.prices.find((p) => p.currency === currency)?.amount ?? 0, currency, locale)
            })
          "
          required
        >
          <UInput
            v-model.number="state.amounts[currency]"
            type="number"
            :step="1 / currencyScale(currency)"
            :disabled="busy"
            class="w-full"
          />
        </UFormField>
      </template>
      <div class="flex gap-2">
        <UButton type="submit" :loading="busy">{{ t('products.save') }}</UButton>
        <UButton type="button" color="neutral" variant="ghost" :disabled="busy" @click="editing = false">{{
          t('products.cancel')
        }}</UButton>
      </div>
    </UForm>
    <p v-if="!product.offers?.length && !editing" class="text-sm text-muted">{{ t('products.offers.empty') }}</p>
    <ul class="divide-y divide-default">
      <li v-for="offer in product.offers" :key="offer.id" class="space-y-2 py-4 first:pt-0 last:pb-0">
        <UBadge color="neutral" variant="subtle">{{ t(`products.offers.${status(offer)}`) }}</UBadge>
        <p class="text-sm">{{ dateLabel(offer.startsAt) }} — {{ dateLabel(offer.endsAt) }}</p>
        <p v-if="offer.isFree" class="font-medium">{{ t('products.freeProduct') }}</p>
        <p v-else class="font-medium">
          {{ offer.prices.map((p) => formatMoney(p.amount, p.currency, locale)).join(' · ') }}
        </p>
        <div v-if="offer.enabled && status(offer) !== 'ended' && !editing" class="flex gap-2">
          <UButton color="neutral" variant="soft" :disabled="disabled || busy" @click="open(offer)">{{
            t('products.offers.edit')
          }}</UButton>
          <UButton color="error" variant="ghost" :disabled="disabled || busy" @click="cancel(offer)">{{
            t('products.offers.cancelOffer')
          }}</UButton>
        </div>
      </li>
    </ul>
  </UCard>
</template>
