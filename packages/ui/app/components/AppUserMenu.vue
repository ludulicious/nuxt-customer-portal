<script setup lang="ts">
import { authClient } from '@nuxt-customer-portal/core/app/utils/auth-client'
import type { DropdownMenuItem } from '@nuxt/ui'

withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'xs'
    inline?: boolean
  }>(),
  {
    size: 'sm',
    inline: false
  }
)

const emit = defineEmits<{ navigate: [] }>()

const { t } = useI18n()
const userStore = useUserStore()
const { currentUser, userInitials } = storeToRefs(userStore)

// Logic preserved from AppHeader
const isOrgAdmin = ref(false)

const signOut = async () => {
  await authClient.signOut()
  userStore.clearUserData()
  emit('navigate')
  await navigateTo('/')
}

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
      }
    ]
  ]

  // Add organization menu items for admins/owners
  if (isOrgAdmin.value && menuItems[1]) {
    menuItems[1].push(
      {
        label: 'Create Organization',
        icon: 'i-lucide-plus-circle',
        to: '/organizations/create'
      },
      {
        label: 'Invite User',
        icon: 'i-lucide-user-plus',
        onSelect: () => {
          // Navigate to organization page with invite modal
          navigateTo('/organization?invite=true')
        }
      }
    )
  }

  menuItems.push([
    {
      label: t('menu.logout'),
      icon: 'i-lucide-log-out',
      onSelect: signOut
    }
  ])

  return menuItems
})
</script>

<template>
  <div v-if="currentUser && inline" class="space-y-2">
    <div class="flex min-w-0 items-center gap-3 px-3 py-2">
      <UAvatar
        :src="currentUser.image ?? undefined"
        :alt="currentUser.name || currentUser.email || 'User'"
        :text="userInitials"
        :size="size"
        class="shrink-0"
      />
      <div class="min-w-0">
        <div class="truncate text-sm font-semibold text-highlighted">{{ currentUser.name || currentUser.email }}</div>
        <div v-if="currentUser.name" class="truncate text-xs text-muted">{{ currentUser.email }}</div>
      </div>
    </div>
    <UButton
      :label="t('menu.settings.title')"
      icon="i-lucide-cog"
      to="/settings"
      color="neutral"
      variant="ghost"
      block
      class="min-h-11 justify-start"
      @click="emit('navigate')"
    />
    <UButton
      :label="t('menu.logout')"
      icon="i-lucide-log-out"
      color="neutral"
      variant="ghost"
      block
      class="min-h-11 justify-start"
      @click="signOut"
    />
  </div>
  <UDropdownMenu v-else-if="currentUser" :items="userMenuItems" :ui="{ content: 'w-48' }">
    <UAvatar
      :src="currentUser.image ?? undefined"
      :alt="currentUser.name || currentUser.email || 'User'"
      :text="userInitials"
      :size="size"
      class="cursor-pointer transition-[box-shadow] hover:ring-2 hover:ring-primary/20"
    />
  </UDropdownMenu>
</template>
