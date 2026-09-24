<script setup lang="ts">
import type { Product } from '../../shared/types'
import { defaultPlanning } from '../../shared/planning'

const props = defineProps<{ product: Product; editing: boolean }>()
const emit = defineEmits<{ edit: [] }>()
const { t } = useI18n()
const members = ref<Array<{ userId: string; name: string; enabled: boolean }>>([])
const installed = ref(false)
const planning = computed(() => props.product.planning || defaultPlanning())
const assigned = computed(() =>
  members.value.filter((member) => planning.value.providerUserIds.includes(member.userId))
)
try {
  members.value = await $fetch('/api/planning/admin/providers')
  installed.value = true
} catch {
  /* Planning is an optional layer. */
}
</script>

<template>
  <UCard v-if="installed">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <h2 class="font-semibold">{{ t('products.planningTitle') }}</h2>
        <UButton
          icon="i-lucide-pencil"
          color="neutral"
          variant="soft"
          :aria-label="t('products.editPlanning')"
          :aria-expanded="editing"
          @click="emit('edit')"
        />
      </div>
    </template>
    <slot v-if="editing" name="editor" />
    <div v-else class="space-y-5">
      <template v-if="planning.enabled">
        <div>
          <p class="text-sm text-muted">{{ t('products.appointmentDuration') }}</p>
          <div class="mt-1 flex flex-wrap items-center justify-between gap-2">
            <p class="text-3xl font-semibold tracking-tight tabular-nums">
              {{ planning.durationMinutes }}
              <span class="text-sm font-normal tracking-normal text-muted">{{ t('products.minutesShort') }}</span>
            </p>
            <UBadge color="primary" variant="subtle" size="sm">{{ t('products.bookingRequired') }}</UBadge>
          </div>
        </div>
        <div class="space-y-2">
          <p class="flex items-center gap-2 text-sm text-muted">
            <UIcon name="i-lucide-users" class="size-4 shrink-0" />
            {{ t('products.planningTeamMembers') }}
          </p>
          <ul class="space-y-2">
            <li v-for="member in assigned" :key="member.userId" class="flex min-w-0 items-center gap-2">
              <UAvatar :alt="member.name" size="2xs" />
              <span class="min-w-0 break-words text-sm font-medium">{{ member.name }}</span>
              <UBadge v-if="!member.enabled" color="neutral" variant="subtle" size="sm" class="shrink-0">{{
                t('products.planningOff')
              }}</UBadge>
            </li>
          </ul>
        </div>
        <dl class="space-y-3 border-t border-default pt-4 text-sm">
          <div class="flex items-center justify-between gap-3">
            <dt class="flex items-center gap-2 text-muted">
              <UIcon name="i-lucide-video" class="size-4 shrink-0" />{{ t('products.meetingProvider') }}
            </dt>
            <dd class="font-medium">{{ planning.meetingProvider === 'zoom' ? 'Zoom' : t('products.noMeeting') }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="flex items-center gap-2 text-muted">
              <UIcon name="i-lucide-shield-check" class="size-4 shrink-0" />{{ t('products.bookingPolicy') }}
            </dt>
            <dd class="text-right font-medium">
              {{
                t(
                  Object.keys(planning.policyOverrides).length ? 'products.customPolicy' : 'products.organizationPolicy'
                )
              }}
            </dd>
          </div>
        </dl>
      </template>
      <div v-else class="flex items-start gap-3">
        <UIcon name="i-lucide-calendar-off" class="mt-0.5 size-5 shrink-0 text-dimmed" />
        <div class="min-w-0">
          <p class="text-sm font-medium">{{ t('products.planningOff') }}</p>
          <p class="mt-1 text-sm text-muted">{{ t('products.noAppointmentRequired') }}</p>
        </div>
      </div>
    </div>
  </UCard>
</template>
