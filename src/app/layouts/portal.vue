<script setup lang="ts">
const route = useRoute()
const toast = useToast()
const open = ref(false)
const showFooter = computed(() => route.meta?.public === true)

const { links } = useNavigationLinks(open)

const groups = computed(() => [{
  id: 'links',
  label: 'Go to',
  items: links.value.flat()
}])

onMounted(async () => {
  const cookie = useCookie('cookie-consent')
  if (cookie.value === 'accepted') {
    return
  }

  toast.add({
    title: 'We use first-party cookies to enhance your experience on our website.',
    duration: 0,
    close: false,
    actions: [{
      label: 'Accept',
      color: 'neutral',
      variant: 'outline',
      onClick: () => {
        cookie.value = 'accepted'
      }
    }, {
      label: 'Opt out',
      color: 'neutral',
      variant: 'ghost'
    }]
  })
})
</script>

<template>
  <div class="relative min-h-screen">
    <!-- AppHeader - fixed at top -->
    <div class="fixed top-0 left-0 right-0 z-50">
      <AppHeader :show-navigation="false" />
    </div>

    <UDashboardGroup unit="rem" class="pt-20 lg:pt-16">
      <UDashboardSidebar id="default" v-model:open="open" collapsible resizable class="bg-elevated/25 lg:pb-12"
        :ui="{ footer: 'lg:border-t lg:border-default' }">
        <template #header="{ collapsed }">
          <TeamsMenu :collapsed="collapsed" />
        </template>
        <template #default="{ collapsed }">
          <TeamsMenu :collapsed="collapsed" class="lg:hidden" />
          <UDashboardSearchButton :collapsed="collapsed" class="bg-transparent ring-default" />
          <UNavigationMenu :collapsed="collapsed" :items="links[0]" orientation="vertical" tooltip popover />
          <UNavigationMenu :collapsed="collapsed" :items="links[1]" orientation="vertical" tooltip class="mt-auto" />
        </template>

        <template #footer="{ collapsed }">
          <UserMenu :collapsed="collapsed" />
        </template>
      </UDashboardSidebar>

      <UDashboardSearch
        :groups="groups"
        :fuse="{
          fuseOptions: {
            ignoreLocation: true,
            threshold: 0.1,
            keys: ['label', 'suffix', '_searchText']
          }
        }"
      />

      <NotificationsSlideover />
      <UMain>
          <slot />
      </UMain>
    </UDashboardGroup>

    <AppFooter v-if="showFooter" />
  </div>
</template>
