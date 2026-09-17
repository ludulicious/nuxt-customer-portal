<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { z } from 'zod'
import type { StripeSettings } from '../../shared/types'

const props = defineProps<{ stripe: StripeSettings }>()
const emit = defineEmits<{ changed: [] }>()
const api = useProducts()
const { t } = useI18n()
const toast = useToast()
const webhookUrl = `${useRequestURL().origin}/api/store/webhooks/stripe`
const { copy, copied } = useClipboard({ source: webhookUrl })
const busy = ref(false)
const testing = ref(false)
const removing = ref(false)
const error = ref('')
const showSecretKey = ref(false)
const showWebhookSecret = ref(false)
const state = reactive({ secretKey: '', webhookSecret: '' })
const schema = z.object({
  secretKey: z
    .string()
    .refine((value) => props.stripe.configured || value.startsWith('sk_'), t('products.stripeSecretRequired')),
  webhookSecret: z
    .string()
    .refine(
      (value) => props.stripe.webhookConfigured || value.startsWith('whsec_'),
      t('products.stripeWebhookRequired')
    )
})

async function save() {
  busy.value = true
  error.value = ''
  try {
    await api.saveStripe({
      secretKey: state.secretKey || undefined,
      webhookSecret: state.webhookSecret || undefined
    })
    state.secretKey = ''
    state.webhookSecret = ''
    toast.add({ title: t('products.stripeSaved'), color: 'success' })
    emit('changed')
  } catch (value) {
    error.value = (value as { data?: { message?: string } }).data?.message || t('products.stripeSaveFailed')
  } finally {
    busy.value = false
  }
}

async function testConnection() {
  testing.value = true
  error.value = ''
  try {
    const result = await api.testStripe({ secretKey: state.secretKey || undefined })
    toast.add({
      title: t('products.stripeTestSucceeded'),
      description: t(result.livemode ? 'products.stripeLiveAccount' : 'products.stripeTestAccount', {
        account: result.accountId
      }),
      color: 'success'
    })
  } catch (value) {
    error.value = (value as { data?: { message?: string } }).data?.message || t('products.stripeTestFailed')
  } finally {
    testing.value = false
  }
}

async function remove() {
  busy.value = true
  try {
    await api.removeStripe()
    removing.value = false
    emit('changed')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-4 pt-4">
    <UAlert v-if="error" color="error" variant="subtle" :title="error" />
    <UForm :state="state" :schema="schema" novalidate class="space-y-4 rounded-lg border p-5" @submit="save">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="font-semibold">{{ t('products.stripePayments') }}</h2>
          <p class="text-sm text-muted">{{ t('products.stripeHelp') }}</p>
        </div>
        <UBadge :color="stripe.configured && stripe.webhookConfigured ? 'success' : 'neutral'">
          {{ t(stripe.configured && stripe.webhookConfigured ? 'products.configured' : 'products.missing') }}
        </UBadge>
      </div>
      <UFormField
        name="secretKey"
        :label="stripe.configured ? t('products.stripeReplaceSecret') : t('products.stripeSecretKey')"
      >
        <UInput
          v-model="state.secretKey"
          :type="showSecretKey ? 'text' : 'password'"
          autocomplete="new-password"
          placeholder="sk_..."
          class="w-full"
        >
          <template #trailing>
            <UButton
              type="button"
              color="neutral"
              variant="link"
              size="xs"
              :icon="showSecretKey ? 'i-lucide-eye-off' : 'i-lucide-eye'"
              :aria-label="t(showSecretKey ? 'products.stripeSecretHide' : 'products.stripeSecretShow')"
              @click="showSecretKey = !showSecretKey"
            />
          </template>
        </UInput>
        <template v-if="stripe.secretKeySuffix" #help>
          {{ t('products.stripeCurrentKey', { suffix: stripe.secretKeySuffix }) }}
        </template>
      </UFormField>
      <UFormField
        name="webhookSecret"
        :label="stripe.webhookConfigured ? t('products.stripeReplaceWebhook') : t('products.stripeWebhookSecret')"
        :help="t('products.stripeWebhookHelp')"
      >
        <UInput
          v-model="state.webhookSecret"
          :type="showWebhookSecret ? 'text' : 'password'"
          autocomplete="new-password"
          placeholder="whsec_..."
          class="w-full"
        >
          <template #trailing>
            <UButton
              type="button"
              color="neutral"
              variant="link"
              size="xs"
              :icon="showWebhookSecret ? 'i-lucide-eye-off' : 'i-lucide-eye'"
              :aria-label="t(showWebhookSecret ? 'products.stripeWebhookHide' : 'products.stripeWebhookShow')"
              @click="showWebhookSecret = !showWebhookSecret"
            />
          </template>
        </UInput>
      </UFormField>
      <UFormField :label="t('products.stripeWebhookUrl')">
        <div class="flex min-w-0 items-center gap-2 rounded-md border border-default bg-elevated/50 px-3 py-2">
          <code class="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-sm">{{ webhookUrl }}</code>
          <UTooltip :text="t(copied ? 'products.stripeWebhookCopied' : 'products.stripeWebhookCopy')">
            <UButton
              type="button"
              :icon="copied ? 'i-lucide-copy-check' : 'i-lucide-copy'"
              color="neutral"
              variant="ghost"
              size="xs"
              :aria-label="t(copied ? 'products.stripeWebhookCopied' : 'products.stripeWebhookCopy')"
              @click="copy()"
            />
          </UTooltip>
        </div>
      </UFormField>
      <div class="flex flex-wrap justify-end gap-3">
        <UButton
          v-if="stripe.configured"
          type="button"
          color="error"
          variant="outline"
          :loading="busy"
          @click="removing = true"
          >{{ t('products.stripeRemove') }}</UButton
        >
        <UButton
          type="button"
          icon="i-lucide-plug-zap"
          color="neutral"
          variant="outline"
          :loading="testing"
          :disabled="busy"
          @click="testConnection"
          >{{ t('products.stripeTestConnection') }}</UButton
        >
        <UButton
          type="submit"
          icon="i-lucide-save"
          class="ml-auto flex min-w-28 justify-center"
          :loading="busy"
          >{{ t('products.save') }}</UButton
        >
      </div>
    </UForm>
    <ConfirmationModal
      v-if="removing"
      v-model:open="removing"
      title="products.stripeRemove"
      message="products.stripeRemoveConfirm"
      confirm-text="products.stripeRemove"
      confirm-color="error"
      @confirm="remove"
    />
  </div>
</template>
