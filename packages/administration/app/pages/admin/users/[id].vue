<script setup lang="ts">
import type { AdminUserResponse, ApiError, UserRole } from '@nuxt-customer-portal/core/shared/types/index'

const route = useRoute()
const { t, locale } = useI18n()
const toast = useToast()
const userStore = useUserStore()
const { isAdmin, currentUser } = storeToRefs(userStore)
const administration = useAdministration()
const id = computed(() => String(route.params.id))

if (!isAdmin.value) {
  throw createError({ statusCode: 403, message: t('admin.errors.accessRequired') })
}

const user = ref<AdminUserResponse | null>(null)
const loading = ref(true)
const error = ref('')
const role = ref<UserRole>('user')
const updatingRole = ref(false)
const showBanModal = ref(false)
const showUnbanModal = ref(false)
const showImpersonateModal = ref(false)
const showSessionsModal = ref(false)
const showPasswordModal = ref(false)
const showUpdateModal = ref(false)
const showDeleteModal = ref(false)

const roles = computed(() => [
  { label: t('admin.user.roles.user'), value: 'user' },
  { label: t('admin.user.roles.admin'), value: 'admin' }
])
const isCurrentUser = computed(() => currentUser.value?.id === user.value?.id)
const canBan = computed(() => Boolean(user.value && user.value.role !== 'admin' && !isCurrentUser.value))
const canDelete = computed(() => Boolean(user.value && user.value.role !== 'admin' && !isCurrentUser.value))
const returnTo = computed(() => {
  const value = String(route.query.returnTo ?? '')
  return value.startsWith('/admin/users') ? value : '/admin/users'
})

useSeoMeta({ title: () => user.value?.name || t('admin.user.detail.title') })

const loadUser = async () => {
  try {
    loading.value = true
    error.value = ''
    user.value = await administration.getUser(id.value)
    role.value = (user.value.role || 'user') as UserRole
  } catch (err) {
    const apiError = err as ApiError
    error.value = apiError.message || t('admin.user.detail.loadFailed')
  } finally {
    loading.value = false
  }
}

const saveRole = async () => {
  if (!user.value || isCurrentUser.value || role.value === user.value.role) return
  try {
    updatingRole.value = true
    await administration.updateUserRole(user.value.id, { role: role.value })
    await loadUser()
    toast.add({ title: t('common.success'), description: t('admin.user.updateRole.success'), color: 'success' })
  } catch (err) {
    const apiError = err as ApiError
    toast.add({ title: t('common.error'), description: apiError.message || t('admin.user.updateRole.error'), color: 'error' })
  } finally {
    updatingRole.value = false
  }
}

const handleDeleted = async () => {
  await navigateTo(returnTo.value)
}

await loadUser()
</script>

<template>
  <div class="h-full min-h-0 overflow-y-auto">
    <div class="mx-auto flex w-full max-w-[1440px] flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <div>
        <UButton :to="returnTo" icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm">
          {{ t('admin.user.detail.back') }}
        </UButton>
      </div>

      <div v-if="loading" class="space-y-4" role="status">
        <USkeleton class="h-28 w-full rounded-lg" />
        <USkeleton class="h-64 w-full rounded-lg" />
        <span class="sr-only">{{ t('admin.user.detail.loading') }}</span>
      </div>

      <UAlert v-else-if="error" color="error" :title="error" variant="outline" />

      <template v-else-if="user">
        <header class="flex flex-col gap-4 border-b border-default pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex min-w-0 items-center gap-4">
            <UAvatar :src="user.image ?? undefined" :alt="user.name || user.email" size="xl" />
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="min-w-0 break-words text-2xl font-semibold text-highlighted">{{ user.name || t('admin.user.list.notAvailable') }}</h1>
                <UBadge :color="user.role === 'admin' ? 'primary' : 'neutral'" variant="subtle">{{ t(`admin.user.roles.${user.role || 'user'}`) }}</UBadge>
                <UBadge :color="user.banned ? 'error' : 'success'" variant="subtle">{{ user.banned ? t('admin.user.status.banned') : t('admin.user.status.notBanned') }}</UBadge>
              </div>
              <p class="mt-1 truncate text-sm text-muted">{{ user.email }}</p>
            </div>
          </div>
          <UButton icon="i-lucide-pencil" variant="outline" class="self-start whitespace-nowrap sm:self-auto" @click="showUpdateModal = true">
            {{ t('admin.user.actions.update') }}
          </UButton>
        </header>

        <div class="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-id-card" class="size-5 text-primary" />
                <h2 class="font-semibold text-highlighted">{{ t('admin.user.detail.accountDetails') }}</h2>
              </div>
            </template>
            <dl class="grid gap-x-6 gap-y-5 sm:grid-cols-2">
              <div>
                <dt class="text-sm text-muted">{{ t('admin.user.list.email') }}</dt>
                <dd class="mt-1 break-all font-medium text-highlighted">{{ user.email }}</dd>
              </div>
              <div>
                <dt class="text-sm text-muted">{{ t('admin.user.list.verified') }}</dt>
                <dd class="mt-1">
                  <UBadge :color="user.emailVerified ? 'success' : 'warning'" variant="subtle">
                    {{ user.emailVerified ? t('admin.user.verification.verified') : t('admin.user.verification.pending') }}
                  </UBadge>
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">{{ t('admin.user.list.created') }}</dt>
                <dd class="mt-1 font-medium text-highlighted">{{ new Date(user.createdAt).toLocaleString(locale) }}</dd>
              </div>
              <div>
                <dt class="text-sm text-muted">{{ t('admin.user.detail.updated') }}</dt>
                <dd class="mt-1 font-medium text-highlighted">{{ new Date(user.updatedAt).toLocaleString(locale) }}</dd>
              </div>
              <div v-if="user.banned && user.banReason" class="sm:col-span-2">
                <dt class="text-sm text-muted">{{ t('admin.user.detail.banReason') }}</dt>
                <dd class="mt-1 font-medium text-highlighted">{{ user.banReason }}</dd>
              </div>
              <div v-if="user.banned && user.banExpires" class="sm:col-span-2">
                <dt class="text-sm text-muted">{{ t('admin.user.detail.banExpires') }}</dt>
                <dd class="mt-1 font-medium text-highlighted">{{ new Date(user.banExpires).toLocaleString(locale) }}</dd>
              </div>
            </dl>
          </UCard>

          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-shield-check" class="size-5 text-primary" />
                <h2 class="font-semibold text-highlighted">{{ t('admin.user.detail.systemRole') }}</h2>
              </div>
            </template>
            <div class="space-y-4">
              <p class="text-sm text-muted">{{ isCurrentUser ? t('admin.user.detail.ownRoleHint') : t('admin.user.updateRole.description') }}</p>
              <UFormField name="role" :label="t('admin.user.list.role')">
                <USelect v-model="role" :items="roles" value-key="value" class="w-full" :disabled="isCurrentUser" />
              </UFormField>
              <div class="flex justify-end">
                <UButton :loading="updatingRole" :disabled="isCurrentUser || role === user.role" @click="saveRole">
                  {{ t('admin.user.updateRole.confirm') }}
                </UButton>
              </div>
            </div>
          </UCard>
        </div>

        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-settings-2" class="size-5 text-primary" />
              <h2 class="font-semibold text-highlighted">{{ t('admin.user.detail.management') }}</h2>
            </div>
          </template>
          <div class="flex flex-wrap gap-2">
            <UButton icon="i-lucide-monitor" color="neutral" variant="outline" @click="showSessionsModal = true">{{ t('admin.user.actions.sessions') }}</UButton>
            <UButton icon="i-lucide-key" color="neutral" variant="outline" @click="showPasswordModal = true">{{ t('admin.user.actions.changePassword') }}</UButton>
            <UButton v-if="!isCurrentUser" icon="i-lucide-user-cog" color="warning" variant="outline" @click="showImpersonateModal = true">{{ t('admin.user.actions.impersonate') }}</UButton>
            <UButton v-if="canBan && !user.banned" icon="i-lucide-ban" color="error" variant="outline" @click="showBanModal = true">{{ t('admin.user.actions.ban') }}</UButton>
            <UButton v-if="canBan && user.banned" icon="i-lucide-circle-check" color="success" variant="outline" @click="showUnbanModal = true">{{ t('admin.user.actions.unban') }}</UButton>
            <UButton v-if="canDelete" icon="i-lucide-trash-2" color="error" variant="ghost" @click="showDeleteModal = true">{{ t('admin.user.actions.delete') }}</UButton>
          </div>
        </UCard>

        <AdminBanUserModal v-if="showBanModal" v-model:open="showBanModal" :user="user" @success="loadUser" />
        <AdminUnbanUserModal v-if="showUnbanModal" v-model:open="showUnbanModal" :user="user" @success="loadUser" />
        <AdminImpersonateUserModal v-if="showImpersonateModal" v-model:open="showImpersonateModal" :user="user" />
        <AdminSessionsModal v-if="showSessionsModal" v-model:open="showSessionsModal" :user="user" />
        <AdminPasswordModal v-if="showPasswordModal" v-model:open="showPasswordModal" :user="user" />
        <AdminUpdateUserModal v-if="showUpdateModal" v-model:open="showUpdateModal" :user="user" @success="loadUser" />
        <AdminDeleteUserModal v-if="showDeleteModal" v-model:open="showDeleteModal" :user="user" @success="handleDeleted" />
      </template>
    </div>
  </div>
</template>
