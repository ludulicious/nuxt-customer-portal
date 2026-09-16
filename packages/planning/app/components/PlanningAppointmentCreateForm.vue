<script setup lang="ts">
import { z } from 'zod'

const emit = defineEmits<{ cancel: [] }>(),
  api = usePlanning(),
  { t, locale } = useI18n(),
  products = ref<Array<{ slug: string; title: string }>>([]),
  state = reactive({ slug: '' }),
  error = ref('')
const schema = computed(() => z.object({ slug: z.string().min(1, t('planning.chooseProduct')) }))
try {
  products.value = await api.bookableProducts()
} catch {
  error.value = t('planning.loadError')
}
async function book() {
  await navigateTo({ path: `/store/${encodeURIComponent(state.slug)}/book`, query: { locale: locale.value } })
}
</script>

<template>
  <UCard class="scroll-mt-24" @keydown.esc.stop="emit('cancel')"
    ><template #header
      ><div class="flex items-center justify-between gap-2">
        <h2 class="font-semibold">{{ t('planning.newAppointment') }}</h2>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          :aria-label="t('planning.close')"
          @click="emit('cancel')"
        /></div></template
    ><UAlert v-if="error" color="error" variant="outline" :title="error" />
    <p class="mb-4 text-sm text-muted">{{ t('planning.newAppointmentNotice') }}</p>
    <UForm :state="state" :schema="schema" novalidate class="space-y-4" @submit="book"
      ><UFormField name="slug" :label="t('planning.product')"
        ><USelectMenu
          v-model="state.slug"
          :items="products.map((p) => ({ value: p.slug, label: p.title }))"
          value-key="value"
          class="w-full"
      /></UFormField>
      <div class="flex justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="emit('cancel')">{{ t('planning.cancelAction') }}</UButton
        ><UButton type="submit" :disabled="!state.slug">{{ t('planning.chooseTime') }}</UButton>
      </div></UForm
    ></UCard
  >
</template>
