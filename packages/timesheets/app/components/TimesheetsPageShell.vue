<script setup lang="ts">
import type { TimesheetsSetupStatusDto } from '@nuxt-customer-portal/timesheets/shared/types/timesheet'

const props = withDefaults(defineProps<{
  as?: string
  width?: 'wide' | 'narrow'
  setupStatus?: TimesheetsSetupStatusDto
}>(), {
  as: 'div',
  width: 'wide',
  setupStatus: undefined
})
const { isOrganizationAdmin } = useTimesheetMenu()
const { activeOrganizationType } = usePortalSession()
const timesheets = useTimesheets()
const { data: loadedSetupStatus } = await useAsyncData<TimesheetsSetupStatusDto | null>(
  'timesheets-setup-status',
  async () => activeOrganizationType.value === 'PROVIDER' && isOrganizationAdmin.value && !props.setupStatus ? await timesheets.setupStatus() : null
)
const visibleSetupStatus = computed(() => props.setupStatus ?? loadedSetupStatus.value)
</script>

<template>
  <component
    :is="as"
    data-timesheets-page-shell
    class="mx-auto w-full px-4 pt-4 pb-5 sm:px-5 md:px-6 md:py-6 lg:px-8 lg:py-8"
    :class="width === 'narrow' ? 'max-w-6xl' : 'max-w-[1440px]'"
  >
    <TimesheetsSetupChecklist v-if="activeOrganizationType === 'PROVIDER' && isOrganizationAdmin && visibleSetupStatus && !visibleSetupStatus.complete" :status="visibleSetupStatus" class="mb-5" />
    <slot />
  </component>
</template>
