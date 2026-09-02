<script setup lang="ts">
import type { GenericClientDto } from '@nuxt-customer-portal/clients/types'

const props = defineProps<{ client: GenericClientDto }>()
const { t } = useI18n()
const invoices = useInvoices()
const { data: access, error } = await useAsyncData(
  `invoice-client-access-${props.client.organizationId}`,
  () => invoices.clientAccessOverview(props.client.organizationId),
  { watch: [() => props.client] }
)
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold">{{ t('features.invoices.clientAccess.title') }}</h2>
      <p class="mt-1 text-sm text-muted">{{ t('features.invoices.clientAccess.description') }}</p>
    </template>
    <UAlert v-if="error" color="error" :title="t('features.invoices.clientAccess.error')" />
    <div v-else-if="access" class="space-y-4">
      <UAlert
        v-if="!access.moduleEnabled || !access.configured || !access.enabled"
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        :title="
          t(
            `features.invoices.clientAccess.${!access.moduleEnabled ? 'moduleDisabled' : !access.configured ? 'notConfigured' : 'disabled'}`
          )
        "
      />
      <p v-if="!access.members.length" class="text-sm text-muted">
        {{ t('features.invoices.clientAccess.noMembers') }}
      </p>
      <div
        v-for="member in access.members"
        :key="member.id"
        class="flex flex-wrap items-center justify-between gap-3 rounded-md border border-default p-3"
      >
        <div class="flex min-w-0 items-center gap-3">
          <UAvatar :src="member.image || undefined" :alt="member.name" size="sm" />
          <div class="min-w-0">
            <p class="font-medium">{{ member.name }}</p>
            <p class="break-all text-sm text-muted">{{ member.email }}</p>
            <p class="text-sm text-muted">
              {{ t(`features.invoices.roles.${member.role}`) }} ·
              {{
                t(
                  `features.invoices.clientAccess.${member.fixedAccess ? 'automatic' : member.assigned ? 'assigned' : 'notAssigned'}`
                )
              }}
            </p>
          </div>
        </div>
        <UBadge :color="member.canView ? 'success' : 'neutral'" variant="subtle">{{
          t(`features.invoices.clientAccess.${member.canView ? 'granted' : 'denied'}`)
        }}</UBadge>
      </div>
      <p class="text-sm text-muted">{{ t('features.invoices.clientAccess.contactsExplanation') }}</p>
    </div>
  </UCard>
</template>
