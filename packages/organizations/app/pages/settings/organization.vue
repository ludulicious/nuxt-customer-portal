<script setup lang="ts">
import type {
  Organization,
  OrganizationInvitationsResponse,
  OrganizationMemberWithUser,
  ApiError,
  MemberRole
} from '@nuxt-customer-portal/core/shared/types/index'
import { authClient } from '@nuxt-customer-portal/core/app/utils/auth-client'
import { canViewOrganizationDirectory as canViewDirectory } from '@nuxt-customer-portal/core/shared/feature-registry'

const userStore = useUserStore()
const { activeOrganizationId } = storeToRefs(userStore)
const { hasPermission } = userStore

const { t } = useI18n()

useSeoMeta({
  title: () => t('settings.organization')
})

const loading = ref(true)
const error = ref('')
const organization = ref<Organization | null>(null)
const members = ref<OrganizationMemberWithUser[]>([])
const invitations = ref<OrganizationInvitationsResponse>([])
const showEditModal = ref(false)
const userOrganizationRole = ref<MemberRole | null>(null)
const canViewOrganizationDirectory = computed(() => canViewDirectory(userOrganizationRole.value))

// Load organization details
const loadOrganization = async () => {
  if (!activeOrganizationId.value) {
    loading.value = false
    organization.value = null
    userOrganizationRole.value = null
    members.value = []
    invitations.value = []
    return
  }
  try {
    loading.value = true
    error.value = ''
    userOrganizationRole.value = null
    const { data: roleData, error: roleError } = await authClient.organization.getActiveMemberRole({
      query: { organizationId: activeOrganizationId.value }
    })
    if (roleError) {
      throw roleError
    }
    userOrganizationRole.value = (roleData?.role as MemberRole | undefined) ?? null
    organization.value = await $fetch<Organization>(`/api/organizations/${activeOrganizationId.value}`)
    if (organization.value && canViewOrganizationDirectory.value) {
      await loadMembers()
      await loadInvitations()
    }
  } catch (err) {
    const apiError = err as ApiError
    error.value = apiError.message || t('organization.settings.errors.loadFailed')
  } finally {
    loading.value = false
  }
}

// Load members
const loadMembers = async () => {
  if (!organization.value) {
    return
  }

  try {
    const { listMembers } = useOrganization()
    const result = await listMembers(organization.value.id)
    if (result.error) {
      throw result.error
    }
    const data = result.data
    members.value = Array.isArray(data)
      ? (data as OrganizationMemberWithUser[])
      : ((data?.members || []) as OrganizationMemberWithUser[])
  } catch (err) {
    console.error('Failed to load members:', err)
    members.value = []
  }
}

// Load invitations
const loadInvitations = async () => {
  if (!organization.value) {
    return
  }

  try {
    invitations.value = await $fetch<OrganizationInvitationsResponse>(
      `/api/organizations/${organization.value.id}/invitations`
    )
  } catch (err) {
    console.error('Failed to load invitations:', err)
    invitations.value = []
  }
}

const handleOrganizationUpdated = async () => {
  showEditModal.value = false
  await userStore.refreshOrganizations()
  await loadOrganization()
}

watch(
  activeOrganizationId,
  (id) => {
    if (id) {
      void loadOrganization()
    } else {
      loading.value = false
      organization.value = null
      userOrganizationRole.value = null
      members.value = []
      invitations.value = []
    }
  },
  { immediate: true }
)
</script>

<template>
  <div>
    <!-- Loading State -->
    <div v-if="loading" class="text-center py-8">
      <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin mx-auto" />
      <p class="text-gray-600 dark:text-gray-400 mt-2">
        {{ t('organization.members.loading') }}
      </p>
    </div>

    <!-- Error State -->
    <UAlert v-else-if="error" color="error" :title="error" variant="outline" />

    <!-- Organization Details -->
    <div v-else-if="organization && hasPermission('organization', 'read')" class="space-y-6">
      <OrganizationDetailsCard
        :organization="organization"
        :role="userOrganizationRole"
        :can-edit="userOrganizationRole === 'owner'"
        :editing="showEditModal"
        @edit="showEditModal = true"
      >
        <template #edit>
          <OrganizationSettings @updated="handleOrganizationUpdated" @canceled="showEditModal = false" />
        </template>
      </OrganizationDetailsCard>

      <OrganizationMembersCard
        v-if="canViewOrganizationDirectory"
        :organization-id="organization.id"
        :members="members"
        :loading="loading"
        :can-manage="true"
        @refresh="loadMembers"
      />
      <OrganizationInvitationsCard
        v-if="canViewOrganizationDirectory"
        :organization-id="organization.id"
        :invitations="invitations"
        :loading="loading"
        :can-manage="true"
        @refresh="loadInvitations"
      />
    </div>
  </div>
</template>
