<script setup lang="ts">
import type { GenericClientDto, ClientListResponse } from '@nuxt-customer-portal/clients/shared/types/client'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const api = useClients()
const { clientIntegrations } = usePortalFeatures()
const runtimeConfig = useRuntimeConfig()
const defaultModules = ((runtimeConfig.public.clients as { defaultModules?: string[] } | undefined)?.defaultModules ?? [])
const search = ref(String(route.query.search ?? ''))
const status = ref(route.query.status === 'archived' ? 'archived' : route.query.status === 'active' ? 'active' : 'all')
const sortBy = ref(['name', 'createdAt', 'status'].includes(String(route.query.sortBy)) ? String(route.query.sortBy) : 'name')
const sortDir = ref<'asc' | 'desc'>(route.query.sortDir === 'desc' ? 'desc' : 'asc')
const page = ref(Math.max(1, Number(route.query.page) || 1))
const result = ref<ClientListResponse | null>(null)
const pending = ref(false)
const busy = ref(false)
const formOpen = ref(false)
const editingId = ref('')
const deletingId = ref('')
const deleteName = ref('')
const deletion = ref<{ canDelete: boolean, memberCount: number, moduleCount: number, clientName: string } | null>(null)
const inviteEmail = ref('')
const inviteRole = ref('member')
const clients = computed(() => result.value?.items ?? [])
const editingClient = computed(() => clients.value.find(item => item.organizationId === editingId.value) ?? null)
const routeQuery = () => ({
  ...(search.value.trim() ? { search: search.value.trim() } : {}), ...(status.value !== 'all' ? { status: status.value } : {}),
  ...(sortBy.value !== 'name' ? { sortBy: sortBy.value } : {}), ...(sortDir.value !== 'asc' ? { sortDir: sortDir.value } : {}), ...(page.value > 1 ? { page: String(page.value) } : {})
})
const load = async () => {
  pending.value = true
  try { result.value = await api.list({ ...routeQuery(), page: page.value, pageSize: 20 }) } finally { pending.value = false }
}
const syncAndLoad = async (resetPage = false) => { if (resetPage) page.value = 1; await router.replace({ path: route.path, query: routeQuery() }); await load() }
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { void syncAndLoad(true) }, 300) })
watch([status, sortBy, sortDir], () => { void syncAndLoad(true) })
onScopeDispose(() => clearTimeout(searchTimer))
onKeyStroke('Escape', () => { formOpen.value = false; editingId.value = ''; deletingId.value = '' })
const positionPanel = async (id: string) => { if (!import.meta.client) return; await nextTick(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }
const edit = async (client: GenericClientDto) => { deletingId.value = ''; editingId.value = editingId.value === client.id ? '' : client.id; if (editingId.value) await positionPanel(`client-editor-${client.id}`) }
const save = async (input: Record<string, unknown>) => {
  busy.value = true
  try {
    if (editingId.value) await api.update(editingId.value, input)
    else await api.create({ ...input, moduleIds: defaultModules })
    formOpen.value = false; editingId.value = ''; await load(); toast.add({ title: t('features.clients.saved'), color: 'success' })
  } catch (error) { toast.add({ title: t('features.clients.saveFailed'), description: String(error), color: 'error' }) } finally { busy.value = false }
}
const toggleModule = async (client: GenericClientDto, moduleId: string, enabled: boolean) => {
  busy.value = true
  try { await api.setModule(client.id, moduleId, enabled); await load() } finally { busy.value = false }
}
const toggleArchive = async (client: GenericClientDto) => { busy.value = true; try { await api.archive(client.id, !client.archivedAt); await load() } finally { busy.value = false } }
const requestDelete = async (client: GenericClientDto) => { editingId.value = ''; deletingId.value = deletingId.value === client.id ? '' : client.id; deleteName.value = ''; deletion.value = deletingId.value ? await api.deletion(client.id) : null; if (deletingId.value) await positionPanel(`client-delete-${client.id}`) }
const confirmDelete = async (client: GenericClientDto) => { busy.value = true; try { await api.remove(client.id, deleteName.value); deletingId.value = ''; await load(); toast.add({ title: t('features.clients.deleted'), color: 'success' }) } finally { busy.value = false } }
const inviteMember = async (client: GenericClientDto) => { busy.value = true; try { await api.invite(client.id, inviteEmail.value, inviteRole.value); inviteEmail.value = ''; inviteRole.value = 'member'; await load(); toast.add({ title: t('features.clients.invited'), color: 'success' }) } finally { busy.value = false } }
const changeMemberRole = async (client: GenericClientDto, memberId: string, role: string) => { busy.value = true; try { await api.updateMember(client.id, memberId, { role }); await load() } finally { busy.value = false } }
const removeMember = async (client: GenericClientDto, memberId: string) => { busy.value = true; try { await api.removeMember(client.id, memberId); await load() } finally { busy.value = false } }
const goToPage = async (value: number) => { page.value = value; await syncAndLoad() }
await load()
</script>

<template>
  <div class="h-full min-h-0 overflow-y-auto">
    <div class="mx-auto flex max-w-[1440px] flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div class="flex gap-3"><UIcon name="i-lucide-building-2" class="mt-1 size-6 text-primary" /><div><h1 class="text-2xl font-semibold">{{ t('features.clients.title') }}</h1><p class="text-sm text-muted">{{ t('features.clients.description') }}</p></div></div>
        <UButton v-if="clients.length && !formOpen" size="sm" variant="outline" icon="i-lucide-plus" @click="formOpen = true; editingId = ''; deletingId = ''">{{ t('features.clients.new') }}</UButton>
      </header>
      <div class="grid gap-2 border-y border-default py-3 sm:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
        <UInput v-model="search" icon="i-lucide-search" :placeholder="t('features.clients.search')" />
        <USelect v-model="status" :items="[{ label: t('features.clients.all'), value: 'all' }, { label: t('features.clients.active'), value: 'active' }, { label: t('features.clients.archived'), value: 'archived' }]" value-key="value" />
        <USelect v-model="sortBy" :items="[{ label: t('features.clients.sortName'), value: 'name' }, { label: t('features.clients.sortCreated'), value: 'createdAt' }, { label: t('features.clients.sortStatus'), value: 'status' }]" value-key="value" />
        <UButton color="neutral" variant="outline" :icon="sortDir === 'asc' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-wide-narrow'" :aria-label="t('features.clients.direction')" @click="sortDir = sortDir === 'asc' ? 'desc' : 'asc'" />
      </div>
      <ClientsClientForm v-if="formOpen" :busy="busy" @submit="save" @cancel="formOpen = false" />
      <UCard v-if="!clients.length && !pending && !formOpen" variant="subtle">
        <div class="flex flex-col items-center gap-3 py-10 text-center"><UIcon name="i-lucide-building-2" class="size-10 text-muted" /><div><h2 class="font-semibold">{{ t('features.clients.emptyTitle') }}</h2><p class="text-sm text-muted">{{ t('features.clients.emptyDescription') }}</p></div><UButton icon="i-lucide-plus" @click="formOpen = true">{{ t('features.clients.createFirst') }}</UButton></div>
      </UCard>
      <div v-else class="grid gap-3">
        <template v-for="client in clients" :key="client.id">
          <UCard role="button" tabindex="0" class="cursor-pointer" :class="editingId === client.id ? 'ring-2 ring-primary' : ''" @click="edit(client)" @keydown.enter="edit(client)" @keydown.space.prevent="edit(client)">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div class="flex min-w-0 items-center gap-3"><UAvatar :src="client.logo ?? undefined" :alt="client.name" /><div class="min-w-0"><p class="truncate font-medium">{{ client.name }}</p><p class="truncate text-sm text-muted">{{ client.officialName }} · {{ client.slug }}</p></div></div><div class="flex items-center gap-2" @click.stop @keydown.stop><UBadge :color="client.archivedAt ? 'neutral' : 'success'" variant="subtle">{{ t(client.archivedAt ? 'features.clients.archived' : 'features.clients.active') }}</UBadge><UButton size="xs" variant="ghost" icon="i-lucide-pencil" :aria-label="t('features.clients.edit')" @click.stop="edit(client)" /><UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" :aria-label="t('features.clients.delete')" @click.stop="requestDelete(client)" /></div></div>
          </UCard>
          <div v-if="editingId === client.id" :id="`client-editor-${client.id}`" class="grid gap-3">
            <ClientsClientForm :client="client" :editing="true" :busy="busy" @submit="save" @cancel="editingId = ''" />
            <UCard><template #header><h2 class="font-semibold">{{ t('features.clients.members') }}</h2></template><div class="grid gap-4"><div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_auto]"><UInput v-model="inviteEmail" type="email" :placeholder="t('features.clients.memberEmail')" /><USelect v-model="inviteRole" :items="['member', 'admin', 'owner']" /><UButton :disabled="!inviteEmail" :loading="busy" @click="inviteMember(client)">{{ t('features.clients.invite') }}</UButton></div><div v-if="client.members.length" class="grid gap-2"><div v-for="item in client.members" :key="item.id" class="flex items-center justify-between gap-3 rounded-md border border-default p-3"><div class="min-w-0"><p class="truncate font-medium">{{ item.name }}</p><p class="truncate text-sm text-muted">{{ item.email }}<template v-if="item.jobTitle"> · {{ item.jobTitle }}</template></p></div><div class="flex items-center gap-2"><USelect :model-value="item.role" :items="['member', 'admin', 'owner']" size="xs" @update:model-value="changeMemberRole(client, item.id, String($event))" /><UButton icon="i-lucide-user-minus" color="error" variant="ghost" size="xs" :aria-label="t('features.clients.removeMember')" @click="removeMember(client, item.id)" /></div></div></div><p v-else class="text-sm text-muted">{{ t('features.clients.noMembers') }}</p><div class="border-t border-default pt-4"><h3 class="mb-3 text-sm font-semibold">{{ t('features.clients.pendingInvitations') }} ({{ client.invitations.length }})</h3><div v-if="client.invitations.length" class="grid gap-2"><div v-for="invitation in client.invitations" :key="invitation.id" class="flex flex-wrap items-center justify-between gap-3 rounded-md border border-default p-3"><div class="min-w-0"><p class="truncate font-medium">{{ invitation.email }}</p><p class="text-sm text-muted">{{ t('features.clients.invitationExpires', { date: new Date(invitation.expiresAt).toLocaleDateString() }) }}</p></div><div class="flex items-center gap-2"><UBadge color="warning" variant="soft">{{ t('features.clients.invitationPending') }}</UBadge><UBadge color="neutral" variant="soft">{{ invitation.role }}</UBadge></div></div></div><p v-else class="text-sm text-muted">{{ t('features.clients.noPendingInvitations') }}</p></div></div></UCard>
            <UCard><template #header><h2 class="font-semibold">{{ t('features.clients.modules') }}</h2></template><div class="grid gap-3"><label v-for="integration in clientIntegrations" :key="integration.moduleId" class="flex items-center justify-between rounded-md border border-default p-3" @click.stop @keydown.stop><span>{{ t(integration.labelKey) }}</span><USwitch :model-value="client.modules.some(item => item.moduleId === integration.moduleId && item.enabled)" :disabled="busy || Boolean(client.archivedAt)" @update:model-value="toggleModule(client, integration.moduleId, $event)" /></label></div></UCard>
            <component :is="integration.detailComponent" v-for="integration in clientIntegrations.filter(item => item.detailComponent && client.modules.some(module => module.moduleId === item.moduleId && module.enabled))" :key="integration.moduleId" :client="client" />
            <div class="flex justify-end"><UButton color="neutral" variant="outline" :icon="client.archivedAt ? 'i-lucide-archive-restore' : 'i-lucide-archive'" :loading="busy" @click="toggleArchive(client)">{{ t(client.archivedAt ? 'features.clients.restore' : 'features.clients.archive') }}</UButton></div>
          </div>
          <UCard v-if="deletingId === client.id" :id="`client-delete-${client.id}`" class="border-error"><template #header><h2 class="font-semibold text-error">{{ t('features.clients.deleteTitle', { name: client.name }) }}</h2></template><div class="space-y-4"><p class="text-sm">{{ deletion?.canDelete ? t('features.clients.deleteDescription') : t('features.clients.deleteBlocked', { members: deletion?.memberCount ?? 0, modules: deletion?.moduleCount ?? 0 }) }}</p><UFormField v-if="deletion?.canDelete" :label="t('features.clients.typeName', { name: client.name })"><UInput v-model="deleteName" /></UFormField><div class="flex justify-end gap-2"><UButton color="neutral" variant="outline" @click="deletingId = ''">{{ t('features.clients.cancel') }}</UButton><UButton v-if="deletion?.canDelete" color="error" icon="i-lucide-trash-2" :disabled="deleteName !== client.name" :loading="busy" @click="confirmDelete(client)">{{ t('features.clients.delete') }}</UButton></div></div></UCard>
        </template>
      </div>
      <div v-if="result && result.pagination.totalPages > 1" class="flex items-center justify-between gap-3"><p class="text-sm text-muted">{{ t('features.clients.resultCount', result.pagination.totalItems) }}</p><UPagination :page="page" :total="result.pagination.totalItems" :items-per-page="20" @update:page="goToPage" /></div>
    </div>
  </div>
</template>
