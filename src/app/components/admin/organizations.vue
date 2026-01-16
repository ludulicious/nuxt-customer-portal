<script setup lang="ts">
import type { AdminOrganizationsResponse, ApiError } from '~~/shared/types'

const { t } = useI18n()
const userStore = useUserStore()
const { isAdmin } = storeToRefs(userStore)

// Redirect if not admin
if (!isAdmin.value) {
  throw createError({ statusCode: 403, message: 'Admin access required' })
}

const loading = ref(true)
const error = ref('')
const organizations = ref<AdminOrganizationsResponse>([])

const loadOrganizations = async () => {
  try {
    loading.value = true
    organizations.value = await $fetch<AdminOrganizationsResponse>('/api/admin/organizations')
  } catch (err) {
    const apiError = err as ApiError
    error.value = apiError.message || t('admin.errors.failedToLoadUsers')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadOrganizations()
})
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 class="text-xl font-semibold">
          {{ t('admin.organization.list.title') }}
        </h2>
        <div class="flex gap-2 w-full sm:w-auto">
          <UButton
            icon="i-lucide-plus"
            color="primary"
            :to="'/admin/organizations/create'"
            class="flex-1 sm:flex-none"
          >
            {{ t('admin.organization.list.createButton') }}
          </UButton>
          <UButton
            icon="i-lucide-refresh-cw"
            variant="outline"
            :loading="loading"
            class="flex-1 sm:flex-none"
            @click="loadOrganizations"
          >
            {{ t('common.refresh') }}
          </UButton>
        </div>
      </div>
    </template>

    <div v-if="loading" class="text-center py-8">
      <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin mx-auto" />
      <p class="text-gray-600 dark:text-gray-400 mt-2">
        {{ t('admin.organization.list.loading') }}
      </p>
    </div>

    <UAlert v-else-if="error" color="error" variant="soft" :title="error" />

    <div v-else-if="organizations.length === 0" class="text-center py-8">
      <p class="text-gray-600 dark:text-gray-400">
        {{ t('admin.organization.list.empty') }}
      </p>
    </div>

    <div v-else class="space-y-4">
      <div v-for="org in organizations" :key="org.id"
        class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="font-semibold text-lg">
              {{ org.name }}
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ t('admin.organization.detail.slug') }} {{ org.slug }}
            </p>
            <p class="text-xs text-gray-500 mt-1">
              {{ t('admin.organization.detail.created') }} {{ new Date(org.createdAt).toLocaleDateString() }}
            </p>
          </div>
          <UButton :to="`/admin/organizations/${org.slug}?from=admin-organizations`" variant="outline" size="sm">
            {{ t('admin.organization.list.view') }}
          </UButton>
        </div>
      </div>
    </div>
  </UCard>
</template>
