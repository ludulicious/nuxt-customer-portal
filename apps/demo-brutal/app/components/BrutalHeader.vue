<script setup lang="ts">
import { en, nl } from '@nuxt/ui/locale'

defineProps<{ sidebarOpen: boolean }>()
const emit = defineEmits<{ toggleSidebar: [] }>()
const { t, locale, setLocale } = useI18n()
const userStore = useUserStore()
const { currentUser, activeOrganization } = storeToRefs(userStore)
const currentLocale = computed({ get: () => locale.value, set: value => setLocale(value) })
const showOrgSwitcher = ref(false)
</script>

<template>
  <header class="brutal-header">
    <div class="brutal-header-leading">
      <UButton
        :icon="sidebarOpen ? 'i-lucide-panel-left-close' : 'i-lucide-menu'"
        color="neutral"
        variant="ghost"
        square
        class="brutal-menu-toggle"
        :ui="{ leadingIcon: 'size-6' }"
        :aria-label="sidebarOpen ? 'Close navigation' : 'Open navigation'"
        @click="emit('toggleSidebar')"
      />
      <NuxtLink to="/" class="brutal-wordmark">BRUTAL<br>WORKS</NuxtLink>
    </div>
    <div class="brutal-header-context">
      <button v-if="activeOrganization" type="button" class="brutal-organization" @click="showOrgSwitcher = true">
        <span>{{ activeOrganization.name }}</span>
        <UIcon name="i-lucide-arrow-left-right" class="size-4" />
      </button>
      <ULocaleSelect v-model="currentLocale" :locales="[en, nl]" class="brutal-desktop-control" :ui="{ content: 'w-max min-w-40', itemLabel: 'whitespace-nowrap' }" />
      <UColorModeButton class="brutal-desktop-control" />
      <div class="brutal-account"><span>{{ currentUser?.name || 'GUEST' }}</span><AppUserMenu /></div>
    </div>
    <UModal v-model:open="showOrgSwitcher" :title="t('menu.switchOrganization')">
      <template #body><OrganizationSwitcher :show-create-button="false" @switched="showOrgSwitcher = false" /></template>
    </UModal>
  </header>
</template>
