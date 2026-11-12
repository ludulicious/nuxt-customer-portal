<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const tabs = computed(() => [
  {
    label: t('features.timesheets.admin.generalSettings'),
    icon: 'i-lucide-settings-2',
    value: '/admin/timesheets/settings'
  },
  {
    label: t('features.timesheets.admin.clients'),
    icon: 'i-lucide-building-2',
    value: '/admin/timesheets/settings/clients'
  },
  {
    label: t('features.timesheets.admin.teamMembers'),
    icon: 'i-lucide-users-round',
    value: '/admin/timesheets/settings/team-members'
  },
  {
    label: t('features.timesheets.internalApprovals.manageTitle'),
    icon: 'i-lucide-user-round-check',
    value: '/admin/timesheets/settings/internal-approvals'
  }
])
const activeTab = computed(() => route.path.replace(/\/$/, ''))
const selectTab = (value: string | number) => navigateTo(String(value))
</script>

<template>
  <TimesheetsAdminSectionPage section="settings">
    <template #default="{ data, refresh }">
      <UTabs
        :model-value="activeTab"
        :items="tabs"
        :content="false"
        variant="link"
        :ui="{ list: 'justify-start overflow-x-auto overflow-y-hidden', trigger: 'grow-0 shrink-0' }"
        @update:model-value="selectTab"
      />
      <NuxtPage :data="data" :refresh="refresh" />
    </template>
  </TimesheetsAdminSectionPage>
</template>
