<script setup lang="ts">
import { z } from 'zod'
import type { GenericClientDto } from '@nuxt-customer-portal/clients/shared/types/client'

const props = defineProps<{ client: GenericClientDto; refresh: () => Promise<unknown> }>()
const emit = defineEmits<{ deleted: [] }>()
const { t } = useI18n()
const toast = useToast()
const api = useClients()
const { clientIntegrations } = usePortalFeatures()
const busy = ref(false)
const editing = ref(false)
const deleting = ref(false)
const deleteName = ref('')
const deletion = ref<{ canDelete: boolean; memberCount: number; moduleCount: number; clientName: string } | null>(null)
const invitationForm = reactive({ email: '', role: 'member' as 'member' | 'admin' | 'owner' })
const invitationSchema = computed(() =>
  z.object({
    email: z.string().trim().email(t('features.clients.validation.email')),
    role: z.enum(['member', 'admin', 'owner'])
  })
)

onKeyStroke('Escape', () => {
  editing.value = false
  deleting.value = false
})

const save = async (input: Record<string, unknown>) => {
  busy.value = true
  try {
    await api.update(props.client.id, input)
    editing.value = false
    await props.refresh()
    toast.add({ title: t('features.clients.saved'), color: 'success' })
  } catch (error) {
    toast.add({ title: t('features.clients.saveFailed'), description: String(error), color: 'error' })
  } finally {
    busy.value = false
  }
}

const toggleModule = async (moduleId: string, enabled: boolean) => {
  busy.value = true
  try {
    await api.setModule(props.client.id, moduleId, enabled)
    await props.refresh()
  } finally {
    busy.value = false
  }
}

const toggleArchive = async () => {
  busy.value = true
  try {
    await api.archive(props.client.id, !props.client.archivedAt)
    await props.refresh()
  } finally {
    busy.value = false
  }
}

const requestDelete = async () => {
  editing.value = false
  deleting.value = !deleting.value
  deleteName.value = ''
  deletion.value = deleting.value ? await api.deletion(props.client.id) : null
}

const confirmDelete = async () => {
  busy.value = true
  try {
    await api.remove(props.client.id, deleteName.value)
    toast.add({ title: t('features.clients.deleted'), color: 'success' })
    emit('deleted')
  } finally {
    busy.value = false
  }
}

const inviteMember = async () => {
  busy.value = true
  try {
    await api.invite(props.client.id, invitationForm.email.trim(), invitationForm.role)
    invitationForm.email = ''
    invitationForm.role = 'member'
    await props.refresh()
    toast.add({ title: t('features.clients.invited'), color: 'success' })
  } catch {
    toast.add({ title: t('features.clients.inviteFailed'), color: 'error' })
  } finally {
    busy.value = false
  }
}

const changeMemberRole = async (memberId: string, role: string) => {
  busy.value = true
  try {
    await api.updateMember(props.client.id, memberId, { role })
    await props.refresh()
  } finally {
    busy.value = false
  }
}

const removeMember = async (memberId: string) => {
  busy.value = true
  try {
    await api.removeMember(props.client.id, memberId)
    await props.refresh()
  } finally {
    busy.value = false
  }
}

const toggleEditing = () => {
  editing.value = !editing.value
  deleting.value = false
}
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-col gap-3 border-b border-default pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div class="flex min-w-0 items-center gap-3">
        <UAvatar :src="client.logo ?? undefined" :alt="client.name" size="lg" />
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="truncate text-2xl font-semibold">{{ client.name }}</h1>
            <UBadge :color="client.archivedAt ? 'neutral' : 'success'" variant="subtle">
              {{ t(client.archivedAt ? 'features.clients.archived' : 'features.clients.active') }}
            </UBadge>
          </div>
          <p class="text-sm text-muted">{{ client.officialName }}</p>
        </div>
      </div>
      <UButton size="sm" variant="outline" icon="i-lucide-pencil" @click="toggleEditing">
        {{ t('features.clients.edit') }}
      </UButton>
    </header>

    <ClientsClientForm
      v-if="editing"
      :client="client"
      :editing="true"
      :busy="busy"
      @submit="save"
      @cancel="editing = false"
    />

    <UCard v-else>
      <template #header>
        <h2 class="font-semibold">{{ t('features.clients.profile') }}</h2>
      </template>
      <dl class="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt class="text-sm text-muted">{{ t('features.clients.name') }}</dt>
          <dd class="font-medium">{{ client.name }}</dd>
        </div>
        <div>
          <dt class="text-sm text-muted">{{ t('features.clients.officialName') }}</dt>
          <dd>{{ client.officialName }}</dd>
        </div>
        <div>
          <dt class="text-sm text-muted">{{ t('features.clients.slug') }}</dt>
          <dd class="font-mono text-sm">{{ client.slug }}</dd>
        </div>
        <div>
          <dt class="text-sm text-muted">{{ t('features.clients.registrationNumber') }}</dt>
          <dd>{{ client.registrationNumber || '—' }}</dd>
        </div>
        <div>
          <dt class="text-sm text-muted">{{ t('features.clients.vatNumber') }}</dt>
          <dd>{{ client.vatNumber || '—' }}</dd>
        </div>
        <div>
          <dt class="text-sm text-muted">{{ t('features.clients.invoiceEmail') }}</dt>
          <dd>{{ client.invoiceEmail || '—' }}</dd>
        </div>
        <div>
          <dt class="text-sm text-muted">{{ t('features.clients.locale') }}</dt>
          <dd>{{ client.preferredLocale === 'nl' ? 'Nederlands' : 'English' }}</dd>
        </div>
        <div class="sm:col-span-2 lg:col-span-3">
          <dt class="text-sm text-muted">{{ t('features.clients.address') }}</dt>
          <dd class="whitespace-pre-line">{{ client.address || '—' }}</dd>
        </div>
      </dl>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t('features.clients.members') }}</h2>
      </template>
      <div class="grid gap-4">
        <UForm
          :state="invitationForm"
          :schema="invitationSchema"
          novalidate
          class="grid items-start gap-2 sm:grid-cols-[minmax(0,1fr)_150px_auto]"
          @submit="inviteMember"
        >
          <UFormField name="email">
            <UInput
              v-model="invitationForm.email"
              type="email"
              :placeholder="t('features.clients.memberEmail')"
              class="w-full"
            />
          </UFormField>
          <UFormField name="role">
            <USelect v-model="invitationForm.role" :items="['member', 'admin', 'owner']" class="w-full" />
          </UFormField>
          <UButton type="submit" :disabled="!invitationForm.email.trim()" :loading="busy">
            {{ t('features.clients.invite') }}
          </UButton>
        </UForm>
        <div v-if="client.members.length" class="grid gap-2">
          <div
            v-for="item in client.members"
            :key="item.id"
            class="flex flex-col gap-3 rounded-md border border-default p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="flex min-w-0 items-center gap-3">
              <UAvatar :src="item.image ?? undefined" :alt="item.name" size="sm" />
              <div class="min-w-0">
                <p class="truncate font-medium">{{ item.name }}</p>
                <p class="truncate text-sm text-muted">
                  {{ item.email }}<template v-if="item.jobTitle"> · {{ item.jobTitle }}</template>
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <USelect
                :model-value="item.role"
                :items="['member', 'admin', 'owner']"
                size="xs"
                @update:model-value="changeMemberRole(item.id, String($event))"
              />
              <UButton
                icon="i-lucide-user-minus"
                color="error"
                variant="ghost"
                size="xs"
                :aria-label="t('features.clients.removeMember')"
                @click="removeMember(item.id)"
              />
            </div>
          </div>
        </div>
        <p v-else class="text-sm text-muted">{{ t('features.clients.noMembers') }}</p>

        <div class="border-t border-default pt-4">
          <h3 class="mb-3 text-sm font-semibold">
            {{ t('features.clients.pendingInvitations') }} ({{ client.invitations.length }})
          </h3>
          <div v-if="client.invitations.length" class="grid gap-2">
            <div
              v-for="invitation in client.invitations"
              :key="invitation.id"
              class="flex flex-wrap items-center justify-between gap-3 rounded-md border border-default p-3"
            >
              <div class="min-w-0">
                <p class="truncate font-medium">{{ invitation.email }}</p>
                <p class="text-sm text-muted">
                  {{
                    t('features.clients.invitationExpires', {
                      date: new Date(invitation.expiresAt).toLocaleDateString()
                    })
                  }}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <UBadge color="warning" variant="soft">{{ t('features.clients.invitationPending') }}</UBadge
                ><UBadge color="neutral" variant="soft">{{ invitation.role }}</UBadge>
                <InvitationActions
                  :endpoint="`/api/clients/${client.id}/invitations/${invitation.id}`"
                  :email="invitation.email"
                  :role="invitation.role"
                  can-edit
                  can-revoke
                  @refresh="refresh()"
                />
              </div>
            </div>
          </div>
          <p v-else class="text-sm text-muted">{{ t('features.clients.noPendingInvitations') }}</p>
        </div>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t('features.clients.modules') }}</h2>
      </template>
      <div class="grid gap-3">
        <label
          v-for="integration in clientIntegrations"
          :key="integration.moduleId"
          class="flex items-center justify-between rounded-md border border-default p-3"
        >
          <span>{{ t(integration.labelKey) }}</span>
          <USwitch
            :model-value="client.modules.some((item) => item.moduleId === integration.moduleId && item.enabled)"
            :disabled="busy || Boolean(client.archivedAt)"
            @update:model-value="toggleModule(integration.moduleId, $event)"
          />
        </label>
      </div>
    </UCard>

    <component
      :is="integration.detailComponent"
      v-for="integration in clientIntegrations.filter(
        (item) =>
          item.detailComponent && client.modules.some((module) => module.moduleId === item.moduleId && module.enabled)
      )"
      :key="integration.moduleId"
      :client="client"
    />

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t('features.clients.lifecycle') }}</h2>
      </template>
      <div class="flex flex-wrap justify-between gap-3">
        <UButton
          color="neutral"
          variant="outline"
          :icon="client.archivedAt ? 'i-lucide-archive-restore' : 'i-lucide-archive'"
          :loading="busy"
          @click="toggleArchive"
        >
          {{ t(client.archivedAt ? 'features.clients.restore' : 'features.clients.archive') }}
        </UButton>
        <UButton color="error" variant="outline" icon="i-lucide-trash-2" @click="requestDelete">
          {{ t('features.clients.delete') }}
        </UButton>
      </div>
    </UCard>

    <UCard v-if="deleting" class="border-error">
      <template #header>
        <h2 class="font-semibold text-error">
          {{ t('features.clients.deleteTitle', { name: client.name }) }}
        </h2>
      </template>
      <div class="space-y-4">
        <p class="text-sm">
          {{
            deletion?.canDelete
              ? t('features.clients.deleteDescription')
              : t('features.clients.deleteBlocked', {
                  members: deletion?.memberCount ?? 0,
                  modules: deletion?.moduleCount ?? 0
                })
          }}
        </p>
        <UFormField v-if="deletion?.canDelete" :label="t('features.clients.typeName', { name: client.name })">
          <UInput v-model="deleteName" />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="outline" @click="deleting = false">
            {{ t('features.clients.cancel') }}
          </UButton>
          <UButton
            v-if="deletion?.canDelete"
            color="error"
            icon="i-lucide-trash-2"
            :disabled="deleteName !== client.name"
            :loading="busy"
            @click="confirmDelete"
          >
            {{ t('features.clients.delete') }}
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
