<script setup lang="ts">
import type { ProviderConfiguration } from '../composables/usePlanning'

const { provider } = defineProps<{ provider: 'google' | 'zoom' }>()
const emit = defineEmits<{ changed: [] }>()
const api = usePlanning(),
  { t } = useI18n(),
  route = useRoute()
const settings = ref<ProviderConfiguration>(),
  busy = ref(false),
  error = ref(route.query.connection === 'error' ? t('planning.connectionError') : '')
const connection = computed(() => settings.value?.connections.find((item) => item.provider === provider))
async function load() {
  settings.value = await api.provider()
}
try {
  await load()
} catch {
  error.value = t('planning.loadError')
}
async function connect(provider: string) {
  busy.value = true
  try {
    window.location.assign((await api.connect(provider)).url)
  } catch {
    error.value = t('planning.connectionError')
    busy.value = false
  }
}
async function disconnect(provider: string) {
  busy.value = true
  try {
    await api.disconnect(provider)
    await load()
    emit('changed')
  } catch {
    error.value = t('planning.actionError')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <UAlert v-if="error" :title="error" color="error" variant="outline" />
    <UCard
      ><template #header
        ><h2 class="font-semibold">{{ provider === 'google' ? 'Google' : 'Zoom' }}</h2></template
      >
      <div class="space-y-4">
        <div class="flex flex-wrap items-center gap-3">
          <span class="font-semibold capitalize">{{ provider }}</span
          ><UBadge variant="subtle" :color="connection?.healthy ? 'success' : 'warning'">{{
            t(connection?.healthy ? 'planning.connected' : 'planning.notConnected')
          }}</UBadge
          ><span v-if="connection?.healthy && connection.externalUserLabel" class="text-sm text-muted">{{
            connection.externalUserLabel
          }}</span
          ><UButton :loading="busy" variant="outline" @click="connect(provider)">{{ t('planning.connect') }}</UButton
          ><UButton v-if="connection" color="neutral" variant="ghost" :disabled="busy" @click="disconnect(provider)">{{
            t('planning.disconnect')
          }}</UButton>
        </div>
      </div></UCard
    >
  </div>
</template>
