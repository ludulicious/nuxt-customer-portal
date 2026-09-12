<script setup lang="ts">
const { t } = useI18n()
const { isAdmin } = storeToRefs(useUserStore())

if (!isAdmin.value) {
  throw createError({ statusCode: 403, message: t('admin.apiKeys.accessRequired') })
}

useSeoMeta({ title: () => t('admin.apiKeys.title') })
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden">
    <div class="min-h-0 flex-1 overflow-y-auto">
      <div class="mx-auto flex w-full max-w-[1440px] flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <header class="flex items-center justify-between gap-3 border-b border-default pb-4 sm:items-end">
          <div class="flex min-w-0 gap-3">
            <UIcon name="i-lucide-key-round" class="mt-1 size-6 shrink-0 text-primary" />
            <div class="min-w-0">
              <h1 class="text-2xl font-semibold text-highlighted">{{ t('admin.apiKeys.title') }}</h1>
              <p class="text-sm text-muted">{{ t('admin.apiKeys.description') }}</p>
            </div>
          </div>
        </header>

        <AdminApiKeySettings />
      </div>
    </div>
  </div>
</template>
