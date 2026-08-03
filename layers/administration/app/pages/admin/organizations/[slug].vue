<script setup lang="ts">
import type { Organization, OrganizationInvitationsResponse, OrganizationMemberWithUser, ApiError } from '#types'

const userStore = useUserStore()
const { isAdmin, myOrganizations } = storeToRefs(userStore)
const { hasPermission } = userStore

const { t } = useI18n()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const slug = computed(() => String(route.params.slug))

// Check if back button should be shown
// For admins, always show back button (defaults to admin organizations list)
// For non-admins, only show when navigating from my-organizations
const showBackButton = computed(() => {
  if (isAdmin.value) {
    return (route.query.from === 'my-organizations' || route.query.from === 'admin-organizations') ? true : false
  }
  return false
})

// Determine back route based on query parameter and user role
const backRoute = computed(() => {
  if (isAdmin.value) {
    if (route.query.from === 'my-organizations') return '/my-organizations'
    if (route.query.from === 'admin-organizations') {
      const query: Record<string, string> = {}
      if (route.query.search != null && route.query.search !== '') query.search = String(route.query.search)
      if (route.query.sortBy != null && route.query.sortBy !== '') query.sortBy = String(route.query.sortBy)
      if (route.query.sortDir != null && route.query.sortDir !== '') query.sortDir = String(route.query.sortDir)
      if (route.query.scroll != null && route.query.scroll !== '') query.scroll = String(route.query.scroll)
      return { path: '/admin/organizations', query }
    }
    return '/admin/organizations'
  }
  return undefined
})

// Determine back button text based on query parameter and user role
const backButtonText = computed(() => {
  if (isAdmin.value) {
    return route.query.from === 'my-organizations'
      ? t('admin.organization.detail.backToMyOrganizations')
      : t('admin.organization.detail.back')
  }
  return t('admin.organization.detail.backToMyOrganizations')
})

const loading = ref(true)
const error = ref('')
const organization = ref<Organization | null>(null)
const members = ref<OrganizationMemberWithUser[]>([])
const invitations = ref<OrganizationInvitationsResponse>([])
const showEditModal = ref(false)

useSeoMeta({
  title: () => organization.value?.name || t('admin.organization.detail.title')
})

// Type for organization with role
type OrganizationWithRole = Organization & { role?: string | null }

// Get user's role in this organization
const userOrganizationRole = computed(() => {
  if (!myOrganizations.value || !organization.value) return null
  const org = myOrganizations.value.find(org => org.slug === organization.value?.slug) as OrganizationWithRole | undefined
  return org?.role || null
})

// Load organization details
const loadOrganization = async () => {
  try {
    loading.value = true
    error.value = ''
    organization.value = await $fetch<Organization>(`/api/admin/organizations/by-slug/${slug.value}`)

    if (organization.value) {
      await loadMembers()
      await loadInvitations()
    }
  } catch (err) {
    const apiError = err as ApiError
    error.value = apiError.message || t('admin.organization.detail.errors.loadFailed')
  } finally {
    loading.value = false
  }
}

// Load members
const loadMembers = async () => {
  if (!organization.value) return

  try {
    // Use admin API endpoint that bypasses membership check
    members.value = await $fetch<OrganizationMemberWithUser[]>(
      `/api/admin/organizations/${organization.value.id}/members`
    )
  } catch (err) {
    console.error('Failed to load members:', err)
    members.value = []
  }
}

// Load invitations
const loadInvitations = async () => {
  if (!organization.value) return

  try {
    // Use admin API endpoint that bypasses membership check
    invitations.value = await $fetch<OrganizationInvitationsResponse>(
      `/api/admin/organizations/${organization.value.id}/invitations`
    )
  } catch (err) {
    console.error('Failed to load invitations:', err)
    invitations.value = []
  }
}

const handleOrganizationUpdated = async (updated: Organization) => {
  organization.value = updated
  showEditModal.value = false
  toast.add({
    title: t('common.success'),
    description: t('organization.settings.updateSuccess'),
    color: 'success'
  })

  if (updated.slug !== slug.value) {
    await router.replace({ params: { ...route.params, slug: updated.slug }, query: route.query })
  }
}

await loadOrganization()

</script>

<template>
  <div class="h-[calc(100dvh-var(--ui-header-height))] min-h-0 overflow-y-auto bg-gray-50 py-8 dark:bg-gray-900">
    <UContainer>
      <!-- Back Button -->
      <div v-if="showBackButton" class="mb-4">
        <UButton icon="i-lucide-arrow-left" variant="ghost" size="sm" :to="backRoute">
          {{ backButtonText }}
        </UButton>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="text-center py-8">
        <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin mx-auto" />
        <p class="text-gray-600 dark:text-gray-400 mt-2">
          {{ t('admin.organization.detail.loading') }}
        </p>
      </div>

      <!-- Error State -->
      <UAlert v-else-if="error" color="error" :title="error" variant="outline" />

      <!-- Organization Details -->
      <div v-else-if="organization && hasPermission('organization', 'read')" class="space-y-6">
        <OrganizationDetailsCard :organization="organization" :role="userOrganizationRole" :can-edit="isAdmin" :editing="showEditModal" @edit="showEditModal = true">
          <template #edit>
            <AdminOrganizationForm :organization="organization" @updated="handleOrganizationUpdated" @canceled="showEditModal = false" />
          </template>
        </OrganizationDetailsCard>

        <OrganizationEmailProviderSettings v-if="isAdmin" :organization-id="organization.id" />

        <AdminOrganizationMembersCard v-if="hasPermission('member', 'list')" :organization-id="organization.id" :members="members" :loading="loading" :can-remove="isAdmin || userOrganizationRole === 'owner' || userOrganizationRole === 'admin'" :can-link="isAdmin" @refresh="loadMembers" />
        <AdminOrganizationInvitationsCard v-if="hasPermission('invitation', 'list')" :organization-id="organization.id" :invitations="invitations" :loading="loading" @refresh="loadInvitations" />
      </div>
    </UContainer>
  </div>
</template>
