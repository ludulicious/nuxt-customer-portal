<script setup lang="ts">
const config = useRuntimeConfig()
const { locale } = useI18n()
const userStore = useUserStore()
const pending = ref(false)
const banner = ref<HTMLElement | null>(null)
const bannerHeight = ref(0)
let resizeObserver: ResizeObserver | undefined
useHead(() => ({
  style: [{ textContent: `:root { --portal-top-bar-height: ${bannerHeight.value}px; }` }]
}))
onBeforeUnmount(() => resizeObserver?.disconnect())
const users = ref<Array<{ id: string; name: string; label: string; labelNl: string; image: string }>>([])
const nl = computed(() => locale.value === 'nl')
onMounted(async () => {
  if (config.public.portalDemo?.enabled) {
    if (banner.value) {
      const updateHeight = () => (bannerHeight.value = banner.value?.getBoundingClientRect().height ?? 0)
      updateHeight()
      resizeObserver = new ResizeObserver(updateHeight)
      resizeObserver.observe(banner.value)
    }
    users.value = await $fetch('/api/demo/users')
  }
})
async function switchUser(id: string) {
  pending.value = true
  try {
    await $fetch('/api/demo/switch', { method: 'POST', body: { userId: id } })
    window.location.assign('/dashboard')
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <aside
    v-if="config.public.portalDemo?.enabled"
    ref="banner"
    data-demo-banner
    class="fixed inset-x-0 top-0 z-[100] flex flex-wrap items-center justify-center gap-3 border-b-2 border-amber-400 bg-amber-100 px-4 py-3 text-sm text-amber-950"
    aria-label="Demo"
  >
    <span class="rounded-md bg-amber-950 px-2 py-1 text-xs font-bold tracking-wider text-amber-100">DEMO</span>
    <strong>{{
      nl ? 'Gedeelde demo · Wijzigingen worden dagelijks gewist.' : 'Shared demo · Changes reset daily.'
    }}</strong>
    <span id="demo-user-label" class="font-semibold">{{ nl ? 'Bekijken als' : 'Explore as' }}</span>
    <USelect
      :model-value="userStore.currentUser?.id"
      :items="
        users.map((user) => ({
          label: `${user.name} · ${nl ? user.labelNl : user.label}`,
          value: user.id,
          avatar: { src: user.image, alt: user.name }
        }))
      "
      :avatar="{ src: users.find((user) => user.id === userStore.currentUser?.id)?.image }"
      :disabled="pending"
      variant="none"
      :ui="{
        base: 'rounded-md bg-amber-50 text-amber-950 font-medium ring ring-amber-400 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800',
        trailingIcon: 'text-amber-800',
        content: 'z-[110] rounded-md bg-amber-50 ring-amber-400',
        item: 'text-amber-950 data-[state=checked]:bg-amber-200 data-[state=checked]:text-amber-950 data-[state=checked]:font-semibold data-highlighted:not-data-disabled:bg-amber-200 data-highlighted:not-data-disabled:text-amber-950 data-highlighted:not-data-disabled:before:bg-amber-200',
        itemTrailingIcon: 'text-amber-800'
      }"
      aria-labelledby="demo-user-label"
      class="w-80 max-w-full"
      @update:model-value="switchUser"
    />
  </aside>
</template>
