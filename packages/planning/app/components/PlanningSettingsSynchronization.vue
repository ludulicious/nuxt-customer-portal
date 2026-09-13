<script setup lang="ts">
const api = usePlanning(),
  { t } = useI18n(),
  jobs = ref<Array<{ id: string; kind: string; attempts: number; error: string | null }>>([]),
  error = ref(''),
  busy = ref(false)
async function load() {
  try {
    jobs.value = await api.jobs()
  } catch {
    error.value = t('planning.loadError')
  }
}
onMounted(load)
async function retry() {
  busy.value = true
  try {
    await api.retry()
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
        ><h2 class="font-semibold">{{ t('planning.pendingTasks') }}</h2></template
      >
      <p v-if="!jobs.length" class="text-sm text-muted">{{ t('planning.noPendingTasks') }}</p>
      <div v-for="job in jobs" :key="job.id" class="mb-3 border-b border-default pb-3 text-sm">
        <p>{{ job.kind }} · {{ t('planning.attempts', { count: job.attempts }) }}</p>
        <p v-if="job.error" class="mt-1 break-words text-error">{{ job.error }}</p>
      </div>
      <UButton v-if="jobs.length" :loading="busy" @click="retry">{{ t('planning.retry') }}</UButton></UCard
    >
  </div>
</template>
