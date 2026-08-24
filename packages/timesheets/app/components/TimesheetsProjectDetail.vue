<script setup lang="ts">
import type { TimesheetsAdminBootstrap } from '@nuxt-customer-portal/timesheets/app/composables/useTimesheets'
import type { ProjectDto } from '@nuxt-customer-portal/timesheets/shared/types/timesheet'

const props = defineProps<{
  project: ProjectDto
  data: TimesheetsAdminBootstrap
  refreshProject: () => Promise<unknown>
  refreshData: () => Promise<unknown>
}>()
const emit = defineEmits<{ deleted: [] }>()
const { t } = useI18n()
const toast = useToast()
const timesheets = useTimesheets()
const busy = ref(false)
const editing = ref(false)
const deleting = ref(false)
const deletionName = ref('')
const deletionPending = ref(false)
const eligibility = ref<{ projectId: string; projectName: string; canDelete: boolean } | null>(null)
const form = reactive({
  clientOrganizationId: '',
  name: '',
  code: '',
  budgetHours: null as number | null,
  budgetAmount: null as number | null,
  activityTypeIds: [] as string[]
})
const rateDrafts = reactive<Record<string, number | null>>({})
const formatHours = (minutes: number) => `${(minutes / 60).toFixed(2)} h`
const formatMoney = (minor: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: props.data.settings.currency }).format(minor / 100)
const activityNames = computed(() =>
  props.project.activityTypeIds
    .map((id) => props.data.activities.find((activity) => activity.id === id)?.name)
    .filter(Boolean)
)
const statusColor = computed(() => (props.project.status === 'ACTIVE' ? 'success' : 'neutral'))
const statusLabel = computed(() => t(`features.timesheets.admin.projectStatus.${props.project.status.toLowerCase()}`))

const resetForm = () =>
  Object.assign(form, {
    clientOrganizationId: props.project.clientOrganizationId,
    name: props.project.name,
    code: props.project.code ?? '',
    budgetHours: props.project.budgetMinutes === null ? null : props.project.budgetMinutes / 60,
    budgetAmount: props.project.budgetMinor === null ? null : props.project.budgetMinor / 100,
    activityTypeIds: [...props.project.activityTypeIds]
  })
const toggleEditing = () => {
  editing.value = !editing.value
  deleting.value = false
  resetForm()
}
const cancelEditing = () => {
  editing.value = false
  resetForm()
}
const resetRates = () => {
  for (const key of Object.keys(rateDrafts)) {
    Reflect.deleteProperty(rateDrafts, key)
  }
  for (const member of props.data.team) {
    rateDrafts[member.id] =
      props.project.personRates[member.id] === undefined ? null : props.project.personRates[member.id]! / 100
  }
}
watch(
  () => props.project,
  () => {
    resetForm()
    resetRates()
  },
  { immediate: true }
)
watch(() => props.data.team, resetRates)

const run = async (operation: () => Promise<unknown>) => {
  busy.value = true
  try {
    await operation()
    await Promise.all([props.refreshProject(), props.refreshData()])
  } catch (error) {
    toast.add({ title: t('features.timesheets.messages.saveError'), description: String(error), color: 'error' })
  } finally {
    busy.value = false
  }
}
const save = () =>
  run(async () => {
    await timesheets.updateProject(props.project.id, {
      clientOrganizationId: form.clientOrganizationId,
      name: form.name,
      code: form.code || null,
      budgetMinutes: form.budgetHours ? Math.round(form.budgetHours * 60) : null,
      budgetMinor: form.budgetAmount ? Math.round(form.budgetAmount * 100) : null,
      activityTypeIds: form.activityTypeIds
    })
    editing.value = false
    toast.add({ title: t('features.timesheets.messages.projectUpdated'), color: 'success' })
  })
const addActivity = async (input: { name: string; billable: boolean }) => {
  await run(() => timesheets.createActivity(input))
  return props.data.activities.find((activity) => activity.name === input.name)?.id
}
const setRateDraft = (userId: string, value: unknown) => {
  rateDrafts[userId] = value === '' || value === null ? null : Number(value)
}
const saveRates = () =>
  run(async () => {
    await timesheets.updateProject(props.project.id, {
      personRates: Object.fromEntries(
        Object.entries(rateDrafts)
          .filter(([, value]) => value !== null && value !== undefined)
          .map(([id, value]) => [id, Math.round(Number(value) * 100)])
      )
    })
    toast.add({ title: t('features.timesheets.messages.rateSaved'), color: 'success' })
  })
const toggleArchived = () =>
  run(async () => {
    const status = props.project.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE'
    await timesheets.updateProject(props.project.id, { status })
    toast.add({
      title: t(
        status === 'ARCHIVED'
          ? 'features.timesheets.messages.projectArchived'
          : 'features.timesheets.messages.projectRestored'
      ),
      color: 'success'
    })
  })
const requestDeletion = async () => {
  editing.value = false
  deleting.value = !deleting.value
  deletionName.value = ''
  eligibility.value = null
  if (!deleting.value) {
    return
  }
  deletionPending.value = true
  try {
    eligibility.value = await timesheets.getProjectDeletionEligibility(props.project.id)
  } catch (error) {
    deleting.value = false
    toast.add({ title: t('features.timesheets.messages.saveError'), description: String(error), color: 'error' })
  } finally {
    deletionPending.value = false
  }
}
const confirmDeletion = async () => {
  if (!eligibility.value?.canDelete || deletionName.value !== eligibility.value.projectName) {
    return
  }
  busy.value = true
  try {
    await timesheets.deleteProject(props.project.id, deletionName.value)
    toast.add({ title: t('features.timesheets.messages.projectDeleted'), color: 'success' })
    emit('deleted')
  } finally {
    busy.value = false
  }
}
onKeyStroke('Escape', () => {
  editing.value = false
  deleting.value = false
  resetForm()
})
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-col gap-3 border-b border-default pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <UIcon name="i-lucide-folder-kanban" class="size-6 shrink-0" />
          <h1 class="truncate text-2xl font-semibold">{{ project.name }}</h1>
          <UBadge :color="statusColor" variant="subtle">{{ statusLabel }}</UBadge>
        </div>
        <p class="mt-1 text-sm text-muted">{{ project.clientName }}{{ project.code ? ` · ${project.code}` : '' }}</p>
      </div>
      <UButton size="sm" variant="outline" icon="i-lucide-pencil" @click="toggleEditing">
        {{ t('features.timesheets.admin.editProject') }}
      </UButton>
    </header>

    <TimesheetsProjectForm
      v-if="editing"
      v-model="form"
      :data="data"
      :editing="true"
      :busy="busy"
      :show-cancel="true"
      :add-activity="addActivity"
      @submit="save"
      @cancel="cancelEditing"
    />

    <UCard v-else>
      <template #header>
        <h2 class="font-semibold">{{ t('features.timesheets.admin.projectDetails') }}</h2>
      </template>
      <dl class="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt class="text-sm text-muted">{{ t('features.timesheets.fields.project') }}</dt>
          <dd class="font-medium">{{ project.name }}</dd>
        </div>
        <div>
          <dt class="text-sm text-muted">{{ t('features.timesheets.admin.client') }}</dt>
          <dd>{{ project.clientName }}</dd>
        </div>
        <div>
          <dt class="text-sm text-muted">{{ t('features.timesheets.admin.code') }}</dt>
          <dd class="font-mono text-sm">{{ project.code || '—' }}</dd>
        </div>
        <div>
          <dt class="text-sm text-muted">{{ t('features.timesheets.admin.hoursBudget') }}</dt>
          <dd>{{ project.budgetMinutes === null ? '—' : formatHours(project.budgetMinutes) }}</dd>
        </div>
        <div>
          <dt class="text-sm text-muted">{{ t('features.timesheets.admin.moneyBudget') }}</dt>
          <dd>{{ project.budgetMinor === null ? '—' : formatMoney(project.budgetMinor) }}</dd>
        </div>
        <div>
          <dt class="text-sm text-muted">{{ t('features.timesheets.admin.activities') }}</dt>
          <dd>{{ activityNames.join(', ') || '—' }}</dd>
        </div>
      </dl>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t('features.timesheets.admin.projectRates') }}</h2>
      </template>
      <div class="space-y-3">
        <div v-for="member in data.team" :key="member.id" class="flex items-center gap-3">
          <span class="min-w-0 flex-1 truncate text-sm">{{ member.name }}</span
          ><UInput
            :model-value="rateDrafts[member.id] ?? undefined"
            type="number"
            min="0"
            step="0.01"
            :placeholder="member.defaultHourlyRateMinor === null ? '—' : String(member.defaultHourlyRateMinor / 100)"
            class="w-32"
            @update:model-value="setRateDraft(member.id, $event)"
          />
        </div>
        <div class="flex justify-end">
          <UButton size="sm" variant="outline" icon="i-lucide-save" :loading="busy" @click="saveRates">
            {{ t('features.timesheets.admin.saveOverrides') }}
          </UButton>
        </div>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t('features.timesheets.admin.projectLifecycle') }}</h2>
      </template>
      <div class="flex flex-wrap justify-between gap-3">
        <UButton
          color="neutral"
          variant="outline"
          :icon="project.status === 'ACTIVE' ? 'i-lucide-archive' : 'i-lucide-archive-restore'"
          :loading="busy"
          @click="toggleArchived"
        >
          {{
            t(
              project.status === 'ACTIVE'
                ? 'features.timesheets.admin.archiveProject'
                : 'features.timesheets.admin.restoreProject'
            )
          }}
        </UButton>
        <UButton color="error" variant="outline" icon="i-lucide-trash-2" @click="requestDeletion">
          {{ t('features.timesheets.admin.deleteProject') }}
        </UButton>
      </div>
    </UCard>

    <UCard v-if="deleting" class="border-error">
      <template #header>
        <h2 class="font-semibold text-error">{{ t('features.timesheets.admin.deleteProject') }}</h2>
      </template>
      <div v-if="deletionPending" class="flex items-center gap-2 text-sm text-muted">
        <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />{{
          t('features.timesheets.admin.checkingProjectDeletion')
        }}
      </div>
      <template v-else-if="eligibility">
        <div class="flex items-center gap-2 text-sm" :class="eligibility.canDelete ? 'text-success' : 'text-error'">
          <UIcon
            :name="eligibility.canDelete ? 'i-lucide-circle-check' : 'i-lucide-circle-x'"
            class="size-5 shrink-0"
          />{{
            t(
              eligibility.canDelete
                ? 'features.timesheets.admin.projectHasNoTimeEntries'
                : 'features.timesheets.admin.projectHasTimeEntries'
            )
          }}
        </div>
        <div v-if="eligibility.canDelete" class="mt-4 space-y-4">
          <p class="text-sm text-muted">
            {{ t('features.timesheets.admin.typeProjectNameToDelete', { name: project.name }) }}
          </p>
          <UFormField :label="t('features.timesheets.admin.projectNameConfirmation')">
            <UInput v-model="deletionName" :placeholder="project.name" autocomplete="off" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="outline" @click="deleting = false">
              {{ t('features.timesheets.cancel') }} </UButton
            ><UButton
              color="error"
              icon="i-lucide-trash-2"
              :loading="busy"
              :disabled="deletionName !== project.name"
              @click="confirmDeletion"
            >
              {{ t('features.timesheets.admin.deleteProject') }}
            </UButton>
          </div>
        </div>
        <div v-else class="mt-4 flex justify-end">
          <UButton color="neutral" variant="outline" @click="deleting = false">
            {{ t('features.timesheets.cancel') }}
          </UButton>
        </div>
      </template>
    </UCard>
  </div>
</template>
