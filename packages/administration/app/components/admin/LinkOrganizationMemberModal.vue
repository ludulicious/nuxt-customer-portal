<script setup lang="ts">
import * as z from 'zod'
import type { AdminUserResponse, MemberRole } from '@nuxt-customer-portal/core/shared/types/index'

const props = defineProps<{
  organizationId: string
  memberUserIds: string[]
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ linked: [] }>()
const { t } = useI18n()
const toast = useToast()
const { searchUsers, linkOrganizationMember } = useAdministration()
const search = ref('')
const users = ref<AdminUserResponse[]>([])
const searching = ref(false)
const linking = ref(false)
const state = reactive<{ userId: string, role: MemberRole }>({ userId: '', role: 'member' })

const schema = computed(() => z.object({
  userId: z.string().min(1, t('admin.organization.detail.members.link.validation.userRequired')),
  role: z.enum(['owner', 'admin', 'member'], { error: t('admin.organization.detail.members.link.validation.roleRequired') })
}))

const availableUsers = computed(() => users.value.filter(user => !props.memberUserIds.includes(user.id)))
const roleItems = computed(() => [
  { label: t('admin.organization.detail.invitations.roleOwner'), value: 'owner' },
  { label: t('admin.organization.detail.invitations.roleAdmin'), value: 'admin' },
  { label: t('admin.organization.detail.invitations.roleMember'), value: 'member' }
])

let searchTimeout: ReturnType<typeof setTimeout> | undefined
const loadUsers = async () => {
  try {
    searching.value = true
    users.value = await searchUsers(search.value)
    if (state.userId && !availableUsers.value.some(user => user.id === state.userId)) state.userId = ''
  } catch (error) {
    const message = error instanceof Error ? error.message : t('admin.organization.detail.members.link.searchFailed')
    toast.add({ title: t('common.error'), description: message, color: 'error' })
  } finally {
    searching.value = false
  }
}

watch(search, () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(loadUsers, 300)
})

watch(open, async (isOpen) => {
  if (!isOpen) return
  search.value = ''
  state.userId = ''
  state.role = 'member'
  await loadUsers()
})

onUnmounted(() => {
  if (searchTimeout) clearTimeout(searchTimeout)
})

const submit = async () => {
  try {
    linking.value = true
    await linkOrganizationMember(props.organizationId, state)
    toast.add({ title: t('common.success'), description: t('admin.organization.detail.members.link.success'), color: 'success' })
    open.value = false
    emit('linked')
  } catch (error) {
    const message = error instanceof Error ? error.message : t('admin.organization.detail.members.link.failed')
    toast.add({ title: t('common.error'), description: message, color: 'error' })
  } finally {
    linking.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="t('admin.organization.detail.members.link.title')" :ui="{ footer: 'justify-end' }">
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-4" @submit="submit">
        <UFormField :label="t('admin.organization.detail.members.link.searchLabel')">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            :placeholder="t('admin.organization.detail.members.link.searchPlaceholder')"
            :loading="searching"
            class="w-full"
          />
        </UFormField>

        <UFormField name="userId" :label="t('admin.organization.detail.members.link.userLabel')" required>
          <div v-if="availableUsers.length" class="max-h-64 space-y-2 overflow-y-auto rounded-md border border-default p-2">
            <button
              v-for="user in availableUsers"
              :key="user.id"
              type="button"
              class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-elevated"
              :class="state.userId === user.id ? 'bg-primary/10 ring-1 ring-primary' : ''"
              @click="state.userId = user.id"
            >
              <UAvatar :src="user.image || undefined" :alt="user.name || user.email" size="sm" />
              <span class="min-w-0">
                <span class="block truncate text-sm font-medium">{{ user.name || user.email }}</span>
                <span class="block truncate text-xs text-muted">{{ user.email }}</span>
              </span>
              <UIcon v-if="state.userId === user.id" name="i-lucide-check" class="ml-auto size-4 shrink-0 text-primary" />
            </button>
          </div>
          <p v-else-if="!searching" class="rounded-md border border-dashed border-default p-4 text-center text-sm text-muted">
            {{ t('admin.organization.detail.members.link.noUsers') }}
          </p>
        </UFormField>

        <UFormField name="role" :label="t('admin.organization.detail.members.link.roleLabel')" required>
          <USelect v-model="state.role" :items="roleItems" value-key="value" class="w-full" />
        </UFormField>

        <div class="flex justify-end gap-2 pt-2">
          <UButton color="neutral" variant="outline" :disabled="linking" @click="open = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton type="submit" icon="i-lucide-user-plus" :loading="linking">
            {{ t('admin.organization.detail.members.link.submit') }}
          </UButton>
        </div>
      </UForm>
    </template>
  </UModal>
</template>
