<script setup lang="ts">
import { z } from 'zod'

const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()
const prefix = 'features.timesheets.trackingClients.'
const api = useClients()
const toast = useToast()
const { activeOrganizationType, activeOrganizationRole } = usePortalSession()
const canManage = computed(
  () => activeOrganizationType.value === 'PROVIDER' && ['owner', 'admin'].includes(activeOrganizationRole.value ?? '')
)
type TrackingClient = { id: string; name: string; enabled: boolean }
const { data, pending, error, refresh } = await useAsyncData('timesheets-tracking-clients', async () => {
  const clients = new Map<string, TrackingClient>()
  let page = 1
  while (true) {
    const result = await api.list({ status: 'active', page, pageSize: 100, sortBy: 'name', sortDir: 'asc' })
    for (const client of result.items) {
      if (!client.archivedAt) {
        clients.set(client.id, {
          id: client.id,
          name: client.name,
          enabled: client.modules.some((module) => module.moduleId === 'timesheets' && module.enabled)
        })
      }
    }
    if (!result.pagination.hasNext) {
      break
    }
    page++
  }
  return [...clients.values()].sort((a, b) => a.name.localeCompare(b.name))
})
const tracked = computed(() => data.value?.filter((client) => client.enabled) ?? [])
const available = computed(
  () =>
    data.value?.filter((client) => !client.enabled).map((client) => ({ label: client.name, value: client.id })) ?? []
)
const adding = ref(false)
const busyId = ref<string | null>(null)
const state = reactive({ clientId: '' })
const schema = computed(() =>
  z.object({
    clientId: z
      .string()
      .min(1, t(prefix + 'required'))
      .refine((id) => available.value.some((client) => client.value === id), t(prefix + 'required'))
  })
)
const update = async (id: string, enabled: boolean) => {
  if (!canManage.value || busyId.value) {
    return
  }
  busyId.value = id
  try {
    await api.setModule(id, 'timesheets', enabled)
    if (enabled) {
      adding.value = false
      state.clientId = ''
    }
    await refresh()
    emit('changed')
    clearNuxtData('timesheet-week')
    clearNuxtData('timesheets-dashboard')
  } catch {
    toast.add({ title: t(prefix + 'error'), color: 'error' })
  } finally {
    busyId.value = null
  }
}
const add = () => update(state.clientId, true)
const cancel = () => {
  adding.value = false
  state.clientId = ''
}
</script>

<template>
  <section class="space-y-3 border-t border-default pt-4" :aria-label="t(prefix + 'title')">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="text-sm font-semibold">{{ t(prefix + 'title') }}</h3>
      <UButton
        v-if="canManage && !adding"
        icon="i-lucide-plus"
        color="neutral"
        variant="outline"
        size="sm"
        :disabled="pending || Boolean(error) || !available.length || Boolean(busyId)"
        @click="adding = true"
        >{{ t(prefix + 'add') }}</UButton
      >
    </div>
    <USkeleton v-if="pending && !data" class="h-8 w-48" />
    <UAlert v-else-if="error" color="error" :title="t(prefix + 'loadError')">
      <template #actions
        ><UButton color="neutral" variant="outline" @click="refresh()">{{
          t('features.timesheets.reviewPeriods.retry')
        }}</UButton></template
      >
    </UAlert>
    <template v-else>
      <div v-if="tracked.length" class="flex flex-wrap gap-2" role="list" :aria-label="t(prefix + 'title')">
        <UBadge
          v-for="client in tracked"
          :key="client.id"
          color="neutral"
          variant="soft"
          size="lg"
          role="listitem"
          class="max-w-full gap-1"
        >
          <span class="min-w-0 break-words whitespace-normal">{{ client.name }}</span>
          <UButton
            v-if="canManage"
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="xs"
            class="shrink-0 p-0.5"
            :aria-label="t(prefix + 'remove', { name: client.name })"
            :title="t(prefix + 'remove', { name: client.name })"
            :disabled="Boolean(busyId)"
            :loading="busyId === client.id"
            @click="update(client.id, false)"
          />
        </UBadge>
      </div>
      <p v-else class="text-sm text-muted">{{ t(prefix + 'empty') }}</p>
      <UForm
        v-if="canManage && adding"
        novalidate
        :schema="schema"
        :state="state"
        class="space-y-3 rounded-md border border-default p-3"
        @submit="add"
      >
        <UFormField name="clientId" :label="t(prefix + 'select')" required>
          <USelectMenu
            v-model="state.clientId"
            :items="available"
            value-key="value"
            :placeholder="t(prefix + 'select')"
            class="w-full"
            :disabled="Boolean(busyId)"
          />
        </UFormField>
        <div class="flex flex-wrap justify-end gap-2">
          <UButton color="neutral" variant="outline" :disabled="Boolean(busyId)" @click="cancel">{{
            t('features.timesheets.reviewPeriods.cancel')
          }}</UButton>
          <UButton type="submit" :disabled="!state.clientId" :loading="Boolean(busyId)">{{
            t(prefix + 'enable')
          }}</UButton>
        </div>
      </UForm>
    </template>
  </section>
</template>
