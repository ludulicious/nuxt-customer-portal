<script setup lang="ts">
import type { SelectItem, TableColumn } from '@nuxt/ui'
import type { AdminUserResponse, ApiError, UserRole, UpdateUserRoleRequest, UpdateUserRoleResponse } from '@nuxt-customer-portal/core/shared/types/index'

defineProps<{
  users: AdminUserResponse[]
  loading?: boolean
  removableUserIds?: string[]
}>()

const emit = defineEmits<{
  refresh: []
  remove: [user: AdminUserResponse]
}>()

const userStore = useUserStore()
const { currentUser } = storeToRefs(userStore)
const { t, locale } = useI18n()
const toast = useToast()
const breakpoints = useBreakpoints({ mobile: 768 })
const isMobile = breakpoints.smaller('mobile')

const editingUserId = ref<string | null>(null)
const editingRole = ref<UserRole>('user')
const updating = ref(false)
const selectedUser = ref<AdminUserResponse | null>(null)
const showBanModal = ref(false)
const showUnbanModal = ref(false)
const showImpersonateModal = ref(false)
const showSessionsModal = ref(false)
const showPasswordModal = ref(false)
const showUpdateModal = ref(false)
const showDeleteModal = ref(false)
const showEditRoleModal = ref(false)

const roles = computed<SelectItem[]>(() => [
  { label: t('admin.user.roles.user'), value: 'user' },
  { label: t('admin.user.roles.admin'), value: 'admin' }
])

const columns = computed<TableColumn<AdminUserResponse>[]>(() => isMobile.value
  ? [
      { accessorKey: 'name', header: t('admin.user.list.name') },
      { accessorKey: 'role', header: t('admin.user.list.role') },
      { accessorKey: 'actions', header: '' }
    ]
  : [
      { accessorKey: 'name', header: t('admin.user.list.name') },
      { accessorKey: 'email', header: t('admin.user.list.email') },
      { accessorKey: 'role', header: t('admin.user.list.role') },
      { accessorKey: 'banned', header: t('admin.user.status.banned') },
      { accessorKey: 'emailVerified', header: t('admin.user.list.verified') },
      { accessorKey: 'createdAt', header: t('admin.user.list.created') },
      { accessorKey: 'actions', header: t('admin.user.list.actions') }
    ])

const startEditRole = (user: AdminUserResponse) => {
  if (currentUser.value?.id === user.id) {
    toast.add({ title: t('common.error'), description: t('admin.errors.cannotChangeOwnRole'), color: 'error' })
    return
  }
  editingRole.value = (user.role || 'user') as UserRole
  if (isMobile.value) {
    selectedUser.value = user
    showEditRoleModal.value = true
  } else {
    editingUserId.value = user.id
  }
}

const updateUserRole = async (userId: string) => {
  if (currentUser.value?.id === userId) return
  try {
    updating.value = true
    await $fetch<UpdateUserRoleResponse>(`/api/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: { role: editingRole.value } satisfies UpdateUserRoleRequest
    })
    editingUserId.value = null
    showEditRoleModal.value = false
    emit('refresh')
    toast.add({ title: t('common.success'), description: t('admin.user.updateRole.success'), color: 'success' })
  } catch (error) {
    const apiError = error as ApiError
    toast.add({ title: t('common.error'), description: apiError.message || t('admin.errors.failedToUpdateRole'), color: 'error' })
  } finally {
    updating.value = false
  }
}

type UserModal = 'ban' | 'unban' | 'impersonate' | 'sessions' | 'password' | 'update' | 'delete'

const selectUser = (user: AdminUserResponse, modal: UserModal) => {
  selectedUser.value = user
  if (modal === 'ban') showBanModal.value = true
  if (modal === 'unban') showUnbanModal.value = true
  if (modal === 'impersonate') showImpersonateModal.value = true
  if (modal === 'sessions') showSessionsModal.value = true
  if (modal === 'password') showPasswordModal.value = true
  if (modal === 'update') showUpdateModal.value = true
  if (modal === 'delete') showDeleteModal.value = true
}

const openBanModal = (user: AdminUserResponse) => {
  if (user.role === 'admin') {
    toast.add({ title: t('common.error'), description: t('admin.user.ban.cannotBanAdmin'), color: 'error' })
    return
  }
  selectUser(user, 'ban')
}
</script>

<template>
  <div>
    <div v-if="users.length === 0" class="py-8 text-center">
      <p class="text-gray-600 dark:text-gray-400">{{ t('admin.user.list.noDataFound') }}</p>
    </div>

    <UTable v-else :data="users" :columns="columns" :loading="loading">
      <template #name-cell="{ row }">
        {{ row.original.name || t('admin.user.list.notAvailable') }}
      </template>

      <template #role-cell="{ row }">
        <div v-if="!isMobile && editingUserId === row.original.id" class="flex items-center gap-2">
          <USelect v-model="editingRole" :items="roles" size="sm" class="w-32" />
          <UButton size="xs" :loading="updating" @click="updateUserRole(row.original.id)">{{ t('common.save') }}</UButton>
          <UButton size="xs" variant="outline" @click="editingUserId = null">{{ t('common.cancel') }}</UButton>
        </div>
        <div v-else class="flex items-center gap-2">
          <UBadge :color="row.original.role === 'admin' ? 'primary' : 'neutral'" class="w-20 justify-center" variant="soft">
            {{ t(`admin.user.roles.${row.original.role}`) }}
          </UBadge>
          <UButton v-if="currentUser?.id !== row.original.id" icon="i-lucide-pencil" size="xs" variant="ghost" @click="startEditRole(row.original)" />
        </div>
      </template>

      <template #banned-cell="{ row }">
        <UBadge :color="row.original.banned ? 'error' : 'success'" variant="soft">
          {{ row.original.banned ? t('admin.user.status.banned') : t('admin.user.status.notBanned') }}
        </UBadge>
      </template>

      <template #emailVerified-cell="{ row }">
        <UBadge :color="row.original.emailVerified ? 'success' : 'warning'" variant="soft">
          {{ row.original.emailVerified ? t('admin.user.verification.verified') : t('admin.user.verification.pending') }}
        </UBadge>
      </template>

      <template #createdAt-cell="{ row }">
        <span class="text-sm text-gray-600 dark:text-gray-400">{{ new Date(row.original.createdAt).toLocaleDateString(locale) }}</span>
      </template>

      <template #actions-cell="{ row }">
        <UDropdownMenu :items="[[
          ...(row.original.role !== 'admin' ? [{ label: row.original.banned ? t('admin.user.actions.unban') : t('admin.user.actions.ban'), icon: 'i-lucide-ban', onSelect: () => row.original.banned ? selectUser(row.original, 'unban') : openBanModal(row.original) }] : []),
          { label: t('admin.user.actions.impersonate'), icon: 'i-lucide-user-cog', onSelect: () => selectUser(row.original, 'impersonate') },
          { label: t('admin.user.actions.sessions'), icon: 'i-lucide-monitor', onSelect: () => selectUser(row.original, 'sessions') },
          { label: t('admin.user.actions.changePassword'), icon: 'i-lucide-key', onSelect: () => selectUser(row.original, 'password') },
          { label: t('admin.user.actions.update'), icon: 'i-lucide-edit', onSelect: () => selectUser(row.original, 'update') },
          ...(row.original.role !== 'admin' && currentUser?.id !== row.original.id ? [{ label: t('admin.user.actions.delete'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => selectUser(row.original, 'delete') }] : []),
          ...(removableUserIds?.includes(row.original.id) ? [{ label: t('admin.organization.detail.members.remove'), icon: 'i-lucide-user-minus', color: 'error' as const, onSelect: () => emit('remove', row.original) }] : [])
        ]]" :content="{ align: 'end' }">
          <UButton variant="ghost" size="sm" icon="i-lucide-more-vertical" />
        </UDropdownMenu>
      </template>
    </UTable>

    <AdminBanUserModal v-if="showBanModal" v-model:open="showBanModal" :user="selectedUser" @success="emit('refresh')" />
    <AdminUnbanUserModal v-if="showUnbanModal" v-model:open="showUnbanModal" :user="selectedUser" @success="emit('refresh')" />
    <AdminImpersonateUserModal v-if="showImpersonateModal" v-model:open="showImpersonateModal" :user="selectedUser" />
    <AdminSessionsModal v-if="showSessionsModal" v-model:open="showSessionsModal" :user="selectedUser" />
    <AdminPasswordModal v-if="showPasswordModal" v-model:open="showPasswordModal" :user="selectedUser" />
    <AdminUpdateUserModal v-if="showUpdateModal" v-model:open="showUpdateModal" :user="selectedUser" @success="emit('refresh')" />
    <AdminDeleteUserModal v-if="showDeleteModal" v-model:open="showDeleteModal" :user="selectedUser" @success="emit('refresh')" />

    <UModal v-model:open="showEditRoleModal" :title="t('admin.user.list.role')" :ui="{ footer: 'justify-end' }">
      <template #body>
        <div class="space-y-4">
          <p v-if="selectedUser" class="text-sm text-gray-600 dark:text-gray-400">
            {{ t('common.edit') }} {{ t('admin.user.list.role') }} for {{ selectedUser.name || selectedUser.email }}
          </p>
          <UFormField name="role" :label="t('admin.user.list.role')"><USelect v-model="editingRole" :items="roles" class="w-full" /></UFormField>
          <div class="flex justify-end gap-2 pt-4">
            <UButton variant="outline" :disabled="updating" @click="showEditRoleModal = false">{{ t('common.cancel') }}</UButton>
            <UButton :loading="updating" @click="selectedUser && updateUserRole(selectedUser.id)">{{ t('common.save') }}</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
