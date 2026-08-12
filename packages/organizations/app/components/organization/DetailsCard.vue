<script setup lang="ts">
import type { Organization } from '@nuxt-customer-portal/core/shared/types/index'

const props = withDefaults(defineProps<{
  canEdit?: boolean
  editing?: boolean
  organization: Organization
  role?: string | null
}>(), {
  canEdit: false,
  editing: false,
  role: null
})

const emit = defineEmits(['edit'])
const { t } = useI18n()
const officialCompanyName = computed(() => {
  if (!props.organization.metadata) return props.organization.name
  try {
    const metadata = JSON.parse(props.organization.metadata) as Record<string, unknown>
    return typeof metadata.officialCompanyName === 'string' ? metadata.officialCompanyName : props.organization.name
  } catch {
    return props.organization.name
  }
})
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-4">
        <h2 class="text-xl font-semibold">{{ t('organization.details.title') }}</h2>
        <UButton
          v-if="canEdit && !editing"
          icon="i-lucide-pencil"
          color="neutral"
          variant="ghost"
          size="xs"
          :aria-label="t('organization.settings.editButton')"
          @click="emit('edit')"
        />
      </div>
    </template>
    <slot v-if="editing" name="edit" />
    <div v-else class="space-y-2">
      <img
        v-if="organization.logo"
        :src="organization.logo"
        :alt="officialCompanyName"
        class="mb-4 max-h-20 max-w-56 object-contain object-left"
      >
      <div>
        <span class="text-sm text-muted">{{ t('organization.details.name') }}</span>
        <div class="flex items-center gap-2">
          <p class="font-semibold">{{ organization.name }}</p>
          <UBadge v-if="role" :color="role === 'owner' ? 'primary' : role === 'admin' ? 'info' : 'neutral'" variant="soft">
            {{ role.charAt(0).toUpperCase() + role.slice(1) }}
          </UBadge>
        </div>
      </div>
      <div>
        <span class="text-sm text-muted">{{ t('organization.details.slug') }}</span>
        <p class="font-mono text-sm">{{ organization.slug }}</p>
      </div>
      <div>
        <span class="text-sm text-muted">{{ t('organization.settings.officialCompanyNameLabel') }}</span>
        <p>{{ officialCompanyName }}</p>
      </div>
      <div>
        <span class="text-sm text-muted">{{ t('organization.details.created') }}</span>
        <p>{{ new Date(organization.createdAt).toLocaleDateString() }}</p>
      </div>
    </div>
  </UCard>
</template>
