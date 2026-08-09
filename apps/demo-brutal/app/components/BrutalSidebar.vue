<script setup lang="ts">
import { en, nl } from '@nuxt/ui/locale'
import { authClient } from '@nuxt-customer-portal/core/app/utils/auth-client'

const open = defineModel<boolean>('open', { required: true })
const { t, locale, setLocale } = useI18n()
const { moduleNavigationGroups, activeModuleId } = useModuleNavigation()
const isDesktop = useMediaQuery('(min-width: 64rem)')
const userStore = useUserStore()
const { currentUser, activeOrganization } = storeToRefs(userStore)
const currentLocale = computed({ get: () => locale.value, set: value => setLocale(value) })
const showOrgSwitcher = ref(false)
const logout = async () => {
  await authClient.signOut()
  userStore.clearUserData()
  await navigateTo('/')
}
const closeMobileNavigation = (event: MouseEvent) => {
  if (!isDesktop.value && (event.target as HTMLElement).closest('a')) open.value = false
}
</script>

<template>
  <aside class="brutal-sidebar" aria-label="Portal navigation">
    <nav class="brutal-sidebar-navigation" @click="closeMobileNavigation">
      <details v-for="module in moduleNavigationGroups" :key="module.id" :open="module.id === activeModuleId">
        <summary>
          <span><UIcon v-if="module.icon" :name="module.icon" class="size-4" />{{ module.label }}</span>
          <UIcon name="i-lucide-chevron-down" class="brutal-module-chevron size-4" />
        </summary>
        <UNavigationMenu :items="module.menuItems" orientation="vertical" />
      </details>
    </nav>
    <div class="brutal-mobile-utilities">
      <button v-if="activeOrganization" type="button" class="brutal-mobile-organization" @click="showOrgSwitcher = true">
        <UIcon name="i-lucide-building-2" class="size-4" /><span>{{ activeOrganization.name }}</span><UIcon name="i-lucide-arrow-left-right" class="ml-auto size-4" />
      </button>
      <div class="brutal-mobile-settings"><ULocaleSelect v-model="currentLocale" :locales="[en, nl]" :ui="{ content: 'w-max min-w-40', itemLabel: 'whitespace-nowrap' }" /><UColorModeButton /></div>
      <div v-if="currentUser" class="brutal-mobile-account">
        <div class="brutal-mobile-identity"><span>{{ currentUser.name }}</span><UAvatar :src="currentUser.image ?? undefined" :alt="currentUser.name" size="sm" /></div>
        <NuxtLink to="/settings"><UIcon name="i-lucide-cog" class="size-4" />{{ t('menu.settings.title') }}</NuxtLink>
        <button type="button" @click="logout"><UIcon name="i-lucide-log-out" class="size-4" />{{ t('menu.logout') }}</button>
      </div>
    </div>
    <UModal v-model:open="showOrgSwitcher" :title="t('menu.switchOrganization')">
      <template #body><OrganizationSwitcher :show-create-button="false" @switched="showOrgSwitcher = false" /></template>
    </UModal>
  </aside>
</template>
