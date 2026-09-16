<script setup lang="ts">
import type { AppointmentListItem } from '../composables/usePlanning'

defineProps<{ item: AppointmentListItem; timezone: string; staff?: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const open = defineModel<boolean>('open', { required: true })
const { t } = useI18n()
const { appointmentRange } = usePlanningTimeDisplay()
</script>

<template>
  <UDrawer
    v-model:open="open"
    direction="right"
    :title="item.title"
    :description="appointmentRange(item.start, item.end, timezone)"
    close
    :ui="{ content: 'w-full sm:max-w-xl' }"
  >
    <template #body>
      <div class="space-y-5">
        <div class="rounded-lg border border-default bg-muted/20 p-4">
          <div class="flex flex-wrap items-center gap-2">
            <UBadge :color="item.status === 'confirmed' ? 'success' : 'neutral'" variant="subtle">
              {{ t(`planning.${item.status}`) }}
            </UBadge>
            <UBadge v-if="item.conflict" color="error" variant="subtle">{{ t('planning.conflict') }}</UBadge>
          </div>
          <dl class="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt class="text-muted">{{ t('planning.time') }}</dt>
              <dd class="mt-1 font-medium">{{ appointmentRange(item.start, item.end, timezone) }}</dd>
              <dd class="text-muted">{{ timezone }}</dd>
            </div>
            <div>
              <dt class="text-muted">{{ t('planning.host') }}</dt>
              <dd class="mt-1 font-medium">{{ item.providerName || t('planning.unknownHost') }}</dd>
              <dd v-if="staff && item.providerEmail" class="text-muted">{{ item.providerEmail }}</dd>
            </div>
            <div v-if="staff">
              <dt class="text-muted">{{ t('planning.customer') }}</dt>
              <dd class="mt-1 font-medium">{{ item.customerName || item.email }}</dd>
              <dd class="text-muted">{{ item.email }}</dd>
            </div>
            <div v-if="item.meetingProvider === 'zoom'">
              <dt class="text-muted">{{ t('planning.meetingProvider') }}</dt>
              <dd class="mt-1">
                <UButton
                  v-if="item.status === 'confirmed' && item.meetingUrl"
                  :to="item.meetingUrl"
                  target="_blank"
                  icon="i-lucide-video"
                  size="xs"
                  variant="outline"
                >
                  {{ t('planning.joinZoom') }}
                </UButton>
                <span v-else class="flex items-start gap-2">
                  <UIcon name="i-lucide-video" class="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>
                    <span class="block font-medium">{{ t('planning.zoomMeeting') }}</span>
                    <span v-if="item.status === 'confirmed'" class="block text-muted">{{
                      t('planning.zoomLinkPending')
                    }}</span>
                  </span>
                </span>
              </dd>
            </div>
          </dl>
        </div>
        <PlanningAppointmentDetails
          :id="item.id"
          :key="item.id"
          :timezone="timezone"
          :show-summary="false"
          @changed="emit('changed')"
        />
      </div>
    </template>
  </UDrawer>
</template>
