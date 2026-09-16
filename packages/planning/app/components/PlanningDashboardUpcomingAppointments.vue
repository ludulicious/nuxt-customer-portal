<script setup lang="ts">
const { t } = useI18n()
const { appointmentRange } = usePlanningTimeDisplay()
const { data, pending, error, refresh } = await usePlanningDashboard()
const staff = computed(() => data.value?.access.staff ?? false)
const timezone = (appointment: NonNullable<typeof data.value>['appointments'][number]) =>
  (staff.value ? appointment.providerTimezone : appointment.customerTimezone) || 'Europe/Amsterdam'
</script>

<template>
  <UCard class="h-full">
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="font-semibold">
            {{ t(staff ? 'planning.dashboard.hostUpcoming' : 'planning.dashboard.clientUpcoming') }}
          </h2>
          <p class="mt-1 text-sm text-muted">{{ t('planning.dashboard.upcomingDescription') }}</p>
        </div>
        <UIcon name="i-lucide-calendar-clock" class="size-5 shrink-0 text-primary" />
      </div>
    </template>

    <div v-if="pending" class="space-y-3" aria-busy="true">
      <USkeleton v-for="item in 2" :key="item" class="h-16 w-full" />
    </div>
    <div v-else-if="error" class="flex items-center justify-between gap-3">
      <p class="text-sm text-muted">{{ t('planning.loadError') }}</p>
      <UButton color="neutral" variant="outline" icon="i-lucide-refresh-cw" @click="refresh()">
        {{ t('dashboard.error.retry') }}
      </UButton>
    </div>
    <div v-else-if="data?.appointments.length" class="divide-y divide-default">
      <article v-for="appointment in data.appointments" :key="appointment.id" class="py-3 first:pt-0 last:pb-0">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <p class="truncate font-medium">{{ appointment.title }}</p>
              <UBadge v-if="appointment.conflict" color="warning" variant="subtle" size="sm">
                {{ t('planning.conflict') }}
              </UBadge>
            </div>
            <p class="mt-1 text-sm text-muted">
              {{ appointmentRange(appointment.start, appointment.end, timezone(appointment)) }}
            </p>
            <p class="mt-1 truncate text-sm text-toned">
              {{ staff ? appointment.customerName : appointment.providerName }}
            </p>
          </div>
          <div class="flex shrink-0 gap-2">
            <UButton
              v-if="appointment.meetingProvider === 'zoom' && appointment.meetingUrl"
              :to="appointment.meetingUrl"
              target="_blank"
              rel="noopener noreferrer"
              size="xs"
              variant="outline"
              icon="i-lucide-video"
              :aria-label="t('planning.joinZoom')"
            />
            <UButton
              :to="`/appointments/${encodeURIComponent(appointment.id)}`"
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-arrow-right"
              :aria-label="t('planning.manage')"
            />
          </div>
        </div>
      </article>
    </div>
    <p v-else class="text-sm text-muted">{{ t('planning.dashboard.noUpcoming') }}</p>

    <template #footer>
      <UButton to="/appointments" color="neutral" variant="outline" icon="i-lucide-calendar-check">
        {{ t('planning.dashboard.viewAppointments') }}
      </UButton>
    </template>
  </UCard>
</template>
