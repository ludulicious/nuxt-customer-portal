<script setup lang="ts">
const { t } = useI18n()
const { data, pending } = await usePlanningDashboard()
const staff = computed(() => data.value?.access.staff ?? false)
</script>

<template>
  <UCard class="h-full">
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="font-semibold">{{ t('planning.dashboard.overview') }}</h2>
          <p class="mt-1 text-sm text-muted">
            {{ t(staff ? 'planning.dashboard.hostOverviewDescription' : 'planning.dashboard.clientOverviewDescription') }}
          </p>
        </div>
        <UIcon name="i-lucide-calendar-range" class="size-5 shrink-0 text-primary" />
      </div>
    </template>

    <div class="grid grid-cols-2 gap-3" :class="staff ? 'sm:grid-cols-3' : ''">
      <div class="rounded-lg border border-default p-4">
        <p class="text-2xl font-semibold tabular-nums">{{ pending ? '…' : (data?.todayCount ?? 0) }}</p>
        <p class="mt-1 text-sm text-muted">{{ t('planning.dashboard.today') }}</p>
      </div>
      <div class="rounded-lg border border-default p-4">
        <p class="text-2xl font-semibold tabular-nums">{{ pending ? '…' : (data?.upcomingCount ?? 0) }}</p>
        <p class="mt-1 text-sm text-muted">{{ t('planning.dashboard.upcoming') }}</p>
      </div>
      <NuxtLink
        v-if="staff"
        :to="{ path: '/appointments', query: { conflicts: 'conflicts' } }"
        class="rounded-lg border border-default p-4 transition hover:border-primary hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        :aria-label="t('planning.dashboard.viewConflicts', { count: data?.conflictCount ?? 0 })"
      >
        <p class="text-2xl font-semibold tabular-nums" :class="data?.conflictCount ? 'text-warning' : ''">
          {{ pending ? '…' : (data?.conflictCount ?? 0) }}
        </p>
        <p class="mt-1 flex items-center gap-1 text-sm text-muted">
          {{ t('planning.dashboard.conflicts') }}
          <UIcon name="i-lucide-arrow-right" class="size-3.5" />
        </p>
      </NuxtLink>
    </div>

    <template #footer>
      <div class="flex flex-wrap gap-2">
        <UButton v-if="staff" to="/availability" variant="outline" icon="i-lucide-calendar-days">
          {{ t('planning.dashboard.manageAvailability') }}
        </UButton>
        <UButton
          v-if="staff"
          to="/planning/settings"
          color="neutral"
          variant="outline"
          icon="i-lucide-calendar-cog"
        >
          {{ t('planning.myAppointmentSettings') }}
        </UButton>
        <UButton v-else to="/appointments" variant="outline" icon="i-lucide-calendar-check">
          {{ t('planning.dashboard.manageBookings') }}
        </UButton>
      </div>
    </template>
  </UCard>
</template>
