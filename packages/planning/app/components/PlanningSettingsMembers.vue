<script setup lang="ts">
import type { ProviderSettings } from '../../shared/types'

const api = usePlanning(),
  { t } = useI18n(),
  members = ref<ProviderSettings[]>([]),
  error = ref(''),
  busy = ref(false)
async function load() {
  try {
    members.value = await api.providers()
  } catch {
    error.value = t('planning.loadError')
  }
}
onMounted(load)
async function toggle(id: string, enabled: boolean) {
  busy.value = true
  try {
    await api.setEnabled(id, enabled)
    await load()
  } catch {
    error.value = t('planning.actionError')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <UAlert v-if="error" variant="outline" color="error" :title="error" /><UCard
      ><template #header
        ><h2 class="font-semibold">{{ t('planning.providers') }}</h2></template
      >
      <div class="space-y-4">
        <div v-for="member in members" :key="member.userId" class="flex flex-wrap items-center gap-3">
          <span class="grow">{{ member.name }}</span
          ><UBadge :color="member.googleConnected ? 'success' : 'warning'" variant="subtle">Google</UBadge
          ><UBadge :color="member.zoomConnected ? 'success' : 'warning'" variant="subtle">Zoom</UBadge
          ><USwitch
            :model-value="member.enabled"
            :disabled="busy"
            :aria-label="t('planning.planning') + ' ' + member.name"
            @update:model-value="toggle(member.userId, $event)"
          />
        </div></div
    ></UCard>
  </div>
</template>
