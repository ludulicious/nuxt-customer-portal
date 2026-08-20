<script setup lang="ts">
definePageMeta({ public: true })

type Tenant = {
  id: string
  slug: string
  lifecycleStatus: string
  canonicalDomain: string
  databaseMode: string
  selectedModules: string[]
}

const { data: tenants, refresh, error } = await useFetch<Tenant[]>('/api/platform/tenants')

const transition = async (tenant: Tenant, status: string) => {
  await $fetch(`/api/platform/tenants/${tenant.id}/lifecycle`, { method: 'PATCH', body: { status } })
  await refresh()
}
</script>

<template>
  <main class="mx-auto max-w-6xl px-6 py-16">
    <div class="flex items-end justify-between gap-4">
      <div>
        <p class="text-sm font-semibold uppercase tracking-widest text-primary">Control plane</p>
        <h1 class="mt-3 text-3xl font-bold">Tenants</h1>
      </div>
      <UButton to="/platform/onboarding">Create tenant</UButton>
    </div>

    <UAlert v-if="error" class="mt-8" color="error" title="Could not load tenants" description="Sign in to the platform and try again." />
    <div v-else class="mt-8 space-y-3">
      <UCard v-for="tenant in tenants || []" :key="tenant.id">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2"><h2 class="font-semibold">{{ tenant.slug }}</h2><UBadge variant="subtle">{{ tenant.lifecycleStatus }}</UBadge></div>
            <a class="mt-1 block text-sm text-muted" :href="`https://${tenant.canonicalDomain}`">{{ tenant.canonicalDomain }}</a>
            <p class="mt-2 text-xs text-muted">{{ tenant.databaseMode }} · {{ tenant.selectedModules.join(', ') }}</p>
          </div>
          <div class="flex gap-2">
            <UButton v-if="tenant.lifecycleStatus === 'ACTIVE'" size="sm" color="warning" variant="soft" @click="transition(tenant, 'READ_ONLY')">Make read-only</UButton>
            <UButton v-if="tenant.lifecycleStatus === 'READ_ONLY'" size="sm" variant="soft" @click="transition(tenant, 'ACTIVE')">Restore</UButton>
            <UButton v-if="tenant.lifecycleStatus === 'READ_ONLY'" size="sm" color="error" variant="soft" @click="transition(tenant, 'DELETION_SCHEDULED')">Schedule deletion</UButton>
          </div>
        </div>
      </UCard>
    </div>
  </main>
</template>
