<script setup lang="ts">
import type { TimesheetsAdminBootstrap } from '#layers/timesheets/app/composables/useTimesheets'

const props = defineProps<{ data: TimesheetsAdminBootstrap, refresh: () => Promise<unknown> }>()
const { t } = useI18n()
const toast = useToast()
const timesheets = useTimesheets()
const busy = ref(false)
const tariffDrafts = reactive<Record<string, number | null>>({})

const run = async (operation: () => Promise<unknown>) => {
  busy.value = true
  try {
    await operation()
    await props.refresh()
  } catch (error) {
    toast.add({ title: t('features.timesheets.messages.saveError'), description: String(error), color: 'error' })
  } finally {
    busy.value = false
  }
}

const saveTariff = (userId: string) => {
  const value = tariffDrafts[userId]
  if (value === null || value === undefined) return
  return run(() => timesheets.setTeamTariff(userId, Math.round(value * 100)))
}
watch(() => props.data, (data) => {
  for (const member of data.team) {
    tariffDrafts[member.id] = member.defaultHourlyRateMinor === null ? null : member.defaultHourlyRateMinor / 100
  }
}, { immediate: true })
</script>

<template>
  <section class="space-y-3">
    <UCard v-for="member in data.team" :key="member.id">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <UAvatar :src="member.image ?? undefined" :alt="member.name" />
        <div class="min-w-0 flex-1"><p class="truncate font-medium">{{ member.name }}</p><p class="truncate text-sm text-muted">{{ member.email }}</p></div>
        <div class="flex items-end gap-2">
          <UFormField :label="`${data.settings.currency} / h`"><UInput v-model.number="tariffDrafts[member.id]" type="number" min="0" step="0.01" class="w-32" /></UFormField>
          <UButton icon="i-lucide-save" :aria-label="t('features.timesheets.save')" :loading="busy" @click="saveTariff(member.id)" />
        </div>
      </div>
    </UCard>
  </section>
</template>
