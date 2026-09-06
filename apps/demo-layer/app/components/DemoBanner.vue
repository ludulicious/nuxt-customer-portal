<script setup lang="ts">
const config = useRuntimeConfig()
const { locale } = useI18n()
const userStore = useUserStore()
const pending = ref(false)
useHead({ style: [{ textContent: 'body:has([data-demo-banner]) { padding-bottom: 7rem; }' }] })
const users = ref<Array<{ id: string; name: string; label: string; labelNl: string }>>([])
const nl = computed(() => locale.value === 'nl')
onMounted(async () => {
  if (config.public.portalDemo?.enabled) {
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
    data-demo-banner
    class="fixed inset-x-0 bottom-0 z-[100] flex flex-wrap items-center justify-center gap-3 border-t-2 border-amber-400 bg-amber-100 px-4 py-3 text-sm text-amber-950 shadow-[0_-4px_20px_rgb(0_0_0/0.15)]"
    aria-label="Demo"
  >
    <span class="rounded-md bg-amber-950 px-2 py-1 text-xs font-bold tracking-wider text-amber-100">DEMO</span>
    <strong>{{
      nl ? 'Gedeelde demo · Wijzigingen worden dagelijks gewist.' : 'Shared demo · Changes reset daily.'
    }}</strong>
    <span id="demo-user-label" class="font-semibold">{{ nl ? 'Bekijken als' : 'Explore as' }}</span>
    <USelect
      :model-value="userStore.currentUser?.id"
      :items="users.map((user) => ({ label: `${user.name} · ${nl ? user.labelNl : user.label}`, value: user.id }))"
      :disabled="pending"
      aria-labelledby="demo-user-label"
      class="w-80"
      @update:model-value="switchUser"
    />
  </aside>
</template>
