<script setup lang="ts">
import { authClient } from '#portal/app/utils/auth-client'
import type { DropdownMenuItem } from '@nuxt/ui'

withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'xs'
}>(), {
  size: 'sm'
})

const { t } = useI18n()
const userStore = useUserStore()
const { currentUser, userInitials } = storeToRefs(userStore)

// Logic preserved from AppHeader
const isOrgAdmin = ref(false)

const userMenuItems = computed(() => {
  const menuItems: DropdownMenuItem[][] = [
    [
      {
        label: currentUser.value?.name || currentUser.value?.email || 'User',
        avatar: {
          src: currentUser.value?.image || undefined,
          alt: currentUser.value?.name || currentUser.value?.email || 'User'
        },
        type: 'label' as const
      }
    ],
    [
      {
        label: t('menu.settings.title'),
        icon: 'i-lucide-cog',
        to: '/settings'
      },
      {
        label: t('menu.documentation'),
        icon: 'i-lucide-book-open-code',
        to: '/api-docs',
        target: '_blank'
      }
    ]
  ]

  // Add organization menu items for admins/owners
  if (isOrgAdmin.value && menuItems[1]) {
    menuItems[1].push({
      label: 'Create Organization',
      icon: 'i-lucide-plus-circle',
      to: '/organizations/create'
    }, {
      label: 'Invite User',
      icon: 'i-lucide-user-plus',
      onSelect: () => {
        // Navigate to organization page with invite modal
        navigateTo('/organization?invite=true')
      }
    })
  }

  menuItems.push([
    {
      label: t('menu.logout'),
      icon: 'i-lucide-log-out',
      onSelect: async () => {
        await authClient.signOut()
        // Explicitly clear user data to ensure immediate state update
        userStore.clearUserData()
        await navigateTo('/')
      }
    }
  ])

  return menuItems
})
</script>

<template>
  <UDropdownMenu v-if="currentUser" :items="userMenuItems" :ui="{ content: 'w-48' }">
    <UAvatar
      :src="currentUser.image ?? undefined"
      :alt="currentUser.name || currentUser.email || 'User'"
      :text="userInitials"
      :size="size"
      class="cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all"
    />
  </UDropdownMenu>
</template>
