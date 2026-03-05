<script setup lang="ts">
const userStore = useUserStore()
const { isAdmin } = storeToRefs(userStore)

// Redirect if not admin
if (!isAdmin.value) {
  throw createError({ statusCode: 403, message: 'Admin access required' })
}

</script>

<template>
  <div>
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
      <UContainer class="py-2 w-full">
        <AdminOrganizations />
      </UContainer>
    </div>
  </div>
</template>
