<script setup lang="ts">
const userStore = useUserStore()
const { isAdmin } = storeToRefs(userStore)
const { t } = useI18n()
// Redirect if not admin
if (!isAdmin.value) {
  throw createError({ statusCode: 403, message: 'Admin access required' })
}
const route = useRoute()
type Tab = 'organizations' | 'users'
const tab = route.params.tab as Tab | undefined
const activeTab = ref<Tab>(tab || 'organizations')
const tabs = computed(() => [
  {
    value: 'organizations',
    label: t('admin.dashboard.organizations'),
  },
  {
    value: 'users',
    label: t('admin.dashboard.users'),
  }
])

watch(activeTab, (newTab) => {
  history.pushState(null, '', `/admin/${newTab}`)
}, { immediate: true })
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Dashboard Header -->
    <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ $t('admin.dashboard.title') }}
            </h1>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {{ $t('admin.dashboard.description') }}
            </p>
          </div>
        </div>
      </div>
    </div>
    <UContainer class="py-2">
      <UTabs v-model="activeTab" size="md" variant="link" :content="false" :items="tabs" class="w-full mb-6" />

      <div class="space-y-6">
        <AdminOrganizations v-if="activeTab === 'organizations'" />
        <AdminUsers v-if="activeTab === 'users'" />
      </div>
    </UContainer>
  </div>
</template>
