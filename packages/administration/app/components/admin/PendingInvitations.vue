<script setup lang="ts">
const props = defineProps<{ search: string }>()
const { t, locale } = useI18n()
const api = useAdministration()
const page = ref(1)
watch(
  () => props.search,
  () => {
    page.value = 1
  }
)
const { data, refresh, error } = await useAsyncData(
  'admin-pending-invitations',
  () => api.listInvitations(page.value, props.search),
  { watch: [page, () => props.search] }
)
</script>

<template>
  <UCard>
    <template #header
      ><h2 class="font-semibold">{{ t('invitationManagement.pending') }} ({{ data?.total ?? 0 }})</h2></template
    >
    <p v-if="error" role="alert">{{ t('invitationManagement.failed') }}</p>
    <div v-else class="grid gap-3">
      <div
        v-for="item in data?.items"
        :key="item.id"
        class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-default p-3"
      >
        <div class="min-w-0">
          <p class="break-all font-medium">{{ item.email }}</p>
          <p class="text-sm text-muted">
            {{ item.organizationName }} · {{ new Date(item.expiresAt).toLocaleDateString(locale) }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <UBadge variant="soft" color="neutral">{{ item.role }}</UBadge>
          <InvitationActions
            :endpoint="`/api/admin/organizations/${item.organizationId}/invitations/${item.id}`"
            :email="item.email"
            :role="item.role"
            can-edit
            can-revoke
            @refresh="refresh()"
          />
        </div>
      </div>
      <p v-if="!data?.total" class="text-sm text-muted">{{ t('invitationManagement.empty') }}</p>
      <UPagination v-if="(data?.total ?? 0) > 20" v-model:page="page" :total="data?.total ?? 0" :items-per-page="20" />
    </div>
  </UCard>
</template>
