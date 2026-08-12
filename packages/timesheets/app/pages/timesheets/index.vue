<script setup lang="ts">
import { addDays, addWeeks, format, getISOWeek, parseISO } from 'date-fns'
import { z } from 'zod'
import type { TimeEntryDto } from '@nuxt-customer-portal/timesheets/shared/types/timesheet'

const { t } = useI18n()
const timesheets = useTimesheets()
const mutationError = useTimesheetMutationError()
const { isOrganizationAdmin } = useTimesheetMenu()

useSeoMeta({
  title: () => t('features.timesheets.title')
})

const selectedWeek = ref<string>()
const selectedDay = ref('')
const modalOpen = ref(false)
const cellEntriesOpen = ref(false)
const timerModalOpen = ref(false)
const saving = ref(false)
const now = ref(Date.now())
let timerInterval: number | undefined

const { data, pending, refresh } = await useAsyncData(
  'timesheet-week',
  () => timesheets.bootstrap(selectedWeek.value),
  { watch: [selectedWeek] }
)

const week = computed(() => data.value?.week)
const projects = computed(() => data.value?.projects.filter(project => project.status === 'ACTIVE') ?? [])
const activities = computed(() => data.value?.activities.filter(activity => activity.active) ?? [])
const rememberedEntryContext = ref<{ projectId: string, activityTypeId: string } | null>(null)
const lastReusableEntryContext = computed(() => {
  if (rememberedEntryContext.value) return rememberedEntryContext.value

  const entry = [...(week.value?.entries ?? [])].reverse().find((candidate) => {
    const project = projects.value.find(item => item.id === candidate.projectId)
    return project?.activityTypeIds.includes(candidate.activityTypeId)
      && activities.value.some(item => item.id === candidate.activityTypeId)
  })

  return entry
    ? { projectId: entry.projectId, activityTypeId: entry.activityTypeId }
    : null
})
const runningEntry = computed(() => week.value?.entries.find(entry => entry.timerStartedAt) ?? null)
const editable = computed(() => Boolean(data.value?.canEnterTime) && ['DRAFT', 'REJECTED'].includes(week.value?.status ?? ''))
const currentMember = computed(() => data.value?.team.find(member => member.id === week.value?.userId))
const selectedActivity = computed(() => activities.value.find(activity => activity.id === form.activityTypeId))
const selectedProject = computed(() => projects.value.find(project => project.id === form.projectId))
const tariffMissing = computed(() => Boolean(
  selectedActivity.value?.billable
  && currentMember.value?.defaultHourlyRateMinor === null
  && selectedProject.value?.personRates[week.value?.userId ?? ''] === undefined
))
const selectedProjectNeedsTariff = computed(() => Boolean(
  selectedProject.value
  && currentMember.value?.defaultHourlyRateMinor === null
  && selectedProject.value.personRates[week.value?.userId ?? ''] === undefined
  && activities.value.some(activity => activity.active && activity.billable && selectedProject.value?.activityTypeIds.includes(activity.id))
))
const workspaceStructureIncomplete = computed(() => data.value
  ? !(
      data.value.setupStatus.hasClient
      && data.value.setupStatus.hasActiveActivity
      && data.value.setupStatus.hasConfiguredProject
    )
  : false)
const memberDefaultTariffMissing = computed(() => Boolean(
  !isOrganizationAdmin.value
  && data.value?.canEnterTime
  && !workspaceStructureIncomplete.value
  && currentMember.value?.defaultHourlyRateMinor === null
  && data.value.setupStatus.billableWorkExists
))
const weekDays = computed(() => {
  if (!week.value) return []
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(parseISO(week.value!.weekStartsOn), index)
    return { value: format(date, 'yyyy-MM-dd'), label: format(date, 'EEE'), day: format(date, 'd') }
  })
})
const selectedDayEntries = computed(() => (week.value?.entries ?? [])
  .filter(entry => entry.entryDate === selectedDay.value)
  .map(entry => {
    const project = projects.value.find(item => item.id === entry.projectId)
    const activity = activities.value.find(item => item.id === entry.activityTypeId)
    return {
      ...entry,
      clientName: project?.clientName ?? '',
      projectName: project?.name ?? '',
      activityName: activity?.name ?? ''
    }
  }))
const selectedDayTotal = computed(() => totalForDate(selectedDay.value))

watch(weekDays, (days) => {
  if (!days.length || days.some(day => day.value === selectedDay.value)) return
  const today = format(new Date(), 'yyyy-MM-dd')
  selectedDay.value = days.find(day => day.value === today)?.value ?? days[0]!.value
}, { immediate: true })

const form = reactive({
  id: null as string | null,
  projectId: '',
  activityTypeId: '',
  entryDate: '',
  hours: 0,
  minutes: 0,
  note: ''
})
const entrySchema = computed(() => z.object({
  id: z.string().nullable(),
  projectId: z.string().min(1, t('features.timesheets.validation.required')),
  activityTypeId: z.string().min(1, t('features.timesheets.validation.required')),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t('features.timesheets.validation.validDate')),
  hours: z.number().int().min(0).max(24, t('features.timesheets.validation.hoursRange')),
  minutes: z.number().int().min(0).max(59, t('features.timesheets.validation.minutesRange')),
  note: z.string().trim().max(2000)
}).refine(value => value.hours * 60 + value.minutes > 0, {
  message: t('features.timesheets.validation.positiveDuration'),
  path: ['hours']
}).refine(value => value.hours * 60 + value.minutes <= 24 * 60, {
  message: t('features.timesheets.validation.maximumDuration'),
  path: ['hours']
}))
const timerSchema = computed(() => z.object({
  id: z.string().nullable(),
  projectId: z.string().min(1, t('features.timesheets.validation.required')),
  activityTypeId: z.string().min(1, t('features.timesheets.validation.required')),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t('features.timesheets.validation.validDate')),
  note: z.string().trim().max(2000)
}))

const activityOptions = computed(() => {
  const selected = projects.value.find(project => project.id === form.projectId)
  return activities.value
    .filter(activity => selected?.activityTypeIds.includes(activity.id))
    .map((activity) => {
      const lacksTariff = activity.billable
        && currentMember.value?.defaultHourlyRateMinor === null
        && selected?.personRates[week.value?.userId ?? ''] === undefined
      return {
        label: `${activity.name}${activity.billable ? lacksTariff ? ` · ${t('features.timesheets.tariffMissingShort')}` : '' : ` · ${t('features.timesheets.nonBillable')}`}`,
        value: activity.id,
        disabled: lacksTariff
      }
    })
})

const projectOptions = computed(() => projects.value.map(project => ({
  label: `${project.clientName} · ${project.name}`,
  value: project.id
})))

const totalForDate = (date: string) => week.value?.entries
  .filter(entry => entry.entryDate === date)
  .reduce((sum, entry) => sum + entry.durationMinutes, 0) ?? 0

const totalMinutes = computed(() => week.value?.entries.reduce(
  (sum, entry) => sum + entry.durationMinutes,
  0
) ?? 0)

const groupedRows = computed(() => {
  const groups = new Map<string, {
    projectId: string
    activityTypeId: string
    clientName: string
    projectName: string
    activityName: string
    label: string
    entries: TimeEntryDto[]
  }>()
  for (const entry of week.value?.entries ?? []) {
    const key = `${entry.projectId}:${entry.activityTypeId}`
    const selectedProject = projects.value.find(project => project.id === entry.projectId)
    const activity = activities.value.find(item => item.id === entry.activityTypeId)
    if (!groups.has(key)) {
      groups.set(key, {
        projectId: entry.projectId,
        activityTypeId: entry.activityTypeId,
        clientName: selectedProject?.clientName ?? '',
        projectName: selectedProject?.name ?? '',
        activityName: activity?.name ?? '',
        label: `${selectedProject?.clientName ?? ''} · ${selectedProject?.name ?? ''} / ${activity?.name ?? ''}`,
        entries: []
      })
    }
    groups.get(key)!.entries.push(entry)
  }
  return [...groups.values()]
})
const selectedCell = ref<{
  row?: (typeof groupedRows.value)[number]
  date: string
  entries: TimeEntryDto[]
} | null>(null)

const formatDuration = (minutes: number) => {
  if (!minutes) return '—'
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
}

const openCreate = (
  date = format(new Date(), 'yyyy-MM-dd'),
  projectId?: string,
  activityTypeId?: string
) => {
  const remembered = lastReusableEntryContext.value
  Object.assign(form, {
    id: null,
    projectId: projectId ?? remembered?.projectId ?? projects.value[0]?.id ?? '',
    activityTypeId: activityTypeId ?? remembered?.activityTypeId ?? '',
    entryDate: date,
    hours: 0,
    minutes: 0,
    note: ''
  })
  modalOpen.value = true
}

const openEdit = (entry: TimeEntryDto) => {
  Object.assign(form, {
    id: entry.id,
    projectId: entry.projectId,
    activityTypeId: entry.activityTypeId,
    entryDate: entry.entryDate,
    hours: Math.floor(entry.durationMinutes / 60),
    minutes: entry.durationMinutes % 60,
    note: entry.note ?? ''
  })
  cellEntriesOpen.value = false
  modalOpen.value = true
}

const openRowCell = (row: (typeof groupedRows.value)[number], date: string) => {
  const entries = row.entries.filter(item => item.entryDate === date)
  if (entries.length) {
    selectedCell.value = { row, date, entries }
    cellEntriesOpen.value = true
    return
  }

  openCreate(date, row.projectId, row.activityTypeId)
}

const openDayCell = (date: string) => {
  const entries = (week.value?.entries ?? []).filter(entry => entry.entryDate === date)
  if (entries.length) {
    selectedCell.value = { date, entries }
    cellEntriesOpen.value = true
    return
  }

  openCreate(date)
}

const addToSelectedCell = () => {
  if (!selectedCell.value) return
  const { row, date } = selectedCell.value
  cellEntriesOpen.value = false
  openCreate(date, row?.projectId, row?.activityTypeId)
}

const entryProject = (entry: TimeEntryDto) => projects.value.find(project => project.id === entry.projectId)
const entryActivity = (entry: TimeEntryDto) => activities.value.find(activity => activity.id === entry.activityTypeId)

const saveEntry = async () => {
  saving.value = true
  try {
    const payload = {
      projectId: form.projectId,
      activityTypeId: form.activityTypeId,
      entryDate: form.entryDate,
      durationMinutes: Number(form.hours) * 60 + Number(form.minutes),
      note: form.note || null
    }
    if (form.id) await timesheets.updateEntry(form.id, payload)
    else await timesheets.createEntry(payload)
    rememberedEntryContext.value = {
      projectId: form.projectId,
      activityTypeId: form.activityTypeId
    }
    modalOpen.value = false
    await refresh()
  } catch (error) {
    mutationError.show(error)
  } finally {
    saving.value = false
  }
}

const removeEntry = async () => {
  if (!form.id) return
  saving.value = true
  try {
    await timesheets.deleteEntry(form.id)
    modalOpen.value = false
    await refresh()
  } catch (error) {
    mutationError.show(error)
  } finally {
    saving.value = false
  }
}

const changeWeek = (amount: number) => {
  const anchor = week.value?.weekStartsOn ?? format(new Date(), 'yyyy-MM-dd')
  selectedWeek.value = format(addWeeks(parseISO(anchor), amount), 'yyyy-MM-dd')
}

const startTimer = async () => {
  saving.value = true
  try {
    await timesheets.startTimer({
      projectId: form.projectId,
      activityTypeId: form.activityTypeId,
      entryDate: format(new Date(), 'yyyy-MM-dd'),
      note: form.note || null
    })
    timerModalOpen.value = false
    await refresh()
  } catch (error) {
    mutationError.show(error, 'features.timesheets.errors.timerStartTitle')
  } finally {
    saving.value = false
  }
}

const openTimer = () => {
  Object.assign(form, {
    id: null,
    projectId: projects.value[0]?.id ?? '',
    activityTypeId: '',
    entryDate: format(new Date(), 'yyyy-MM-dd'),
    hours: 0,
    minutes: 0,
    note: ''
  })
  timerModalOpen.value = true
}

const stopTimer = async () => {
  try {
    await timesheets.stopTimer()
    await refresh()
  } catch (error) {
    mutationError.show(error)
  }
}

const submit = async () => {
  if (!week.value) return
  try {
    await timesheets.submitWeek(week.value.id)
    await refresh()
  } catch (error) {
    mutationError.show(error)
  }
}

onMounted(() => {
  timerInterval = window.setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onBeforeUnmount(() => {
  if (timerInterval !== undefined) window.clearInterval(timerInterval)
})

const runningDuration = computed(() => {
  if (!runningEntry.value?.timerStartedAt) return ''
  const seconds = Math.floor((now.value - new Date(runningEntry.value.timerStartedAt).getTime()) / 1000)
  return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
})
</script>

<template>
  <TimesheetsPageShell class="timesheet-workbench space-y-5" :setup-status="data?.setupStatus">
    <header class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-highlighted">
          {{ t('features.timesheets.title') }}
        </h1>
        <p class="mt-1 text-sm text-muted">
          {{ t('features.timesheets.subtitle') }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <UButton icon="i-lucide-chevron-left" color="neutral" variant="outline" :aria-label="t('features.timesheets.previousWeek')" @click="changeWeek(-1)" />
        <UBadge color="neutral" variant="subtle" size="lg">
          {{ week ? `${t('features.timesheets.weekNumber', { number: getISOWeek(parseISO(week.weekStartsOn)) })} · ${format(parseISO(week.weekStartsOn), 'd MMM')} – ${format(addDays(parseISO(week.weekStartsOn), 6), 'd MMM yyyy')}` : '—' }}
        </UBadge>
        <UButton icon="i-lucide-chevron-right" color="neutral" variant="outline" :aria-label="t('features.timesheets.nextWeek')" @click="changeWeek(1)" />
        <UTooltip v-if="!runningEntry" class="ml-auto sm:hidden" :text="t('features.timesheets.timer.start')">
          <UButton
            class="size-11 justify-center rounded-full p-0"
            icon="i-lucide-timer"
            color="success"
            size="lg"
            square
            :aria-label="t('features.timesheets.timer.start')"
            :disabled="!editable"
            @click="openTimer"
          />
        </UTooltip>
        <UButton v-if="!runningEntry" class="hidden sm:ml-auto sm:inline-flex" icon="i-lucide-timer" color="success" :disabled="!editable" @click="openTimer">
          {{ t('features.timesheets.timer.start') }}
        </UButton>
      </div>
    </header>

    <UAlert
      v-if="week?.status === 'REJECTED'"
      color="error"
      icon="i-lucide-message-square-warning"
      :title="t('features.timesheets.status.rejected')"
      :description="week.rejectionComment ?? undefined" variant="outline" />

    <UAlert v-if="data && !data.canEnterTime" color="warning" icon="i-lucide-clock-alert" :title="t('features.timesheets.errors.entryDisabledTitle')" :description="t('features.timesheets.errors.entryDisabled')" variant="outline" />
    <UAlert v-else-if="memberDefaultTariffMissing" color="warning" icon="i-lucide-badge-alert" :title="t('features.timesheets.errors.memberTariffMissingTitle')" :description="t('features.timesheets.errors.memberTariffMissingDescription')" variant="outline" />

    <UCard v-if="runningEntry" class="timesheet-timer">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <p class="text-xs font-medium text-muted">
            {{ t('features.timesheets.timer.running') }}
          </p>
          <p class="truncate font-medium">
            {{ projects.find(item => item.id === runningEntry?.projectId)?.name }} ·
            {{ activities.find(item => item.id === runningEntry?.activityTypeId)?.name }}
          </p>
        </div>
        <div class="flex items-center gap-3">
          <span class="font-mono text-lg tabular-nums">{{ runningDuration }}</span>
          <UButton icon="i-lucide-square" color="error" @click="stopTimer">
            {{ t('features.timesheets.timer.stop') }}
          </UButton>
        </div>
      </div>
    </UCard>

    <UCard class="hidden xl:block" :ui="{ body: '!p-0' }">
      <div v-if="pending" class="p-8 text-center text-muted">
        {{ t('features.timesheets.loading') }}
      </div>
      <div v-else class="overflow-x-clip">
        <div class="timesheet-grid text-sm">
          <div class="timesheet-grid__cell font-medium text-muted">
            {{ t('features.timesheets.projectActivity') }}
          </div>
          <div
            v-for="(day, index) in weekDays"
            :key="day.value"
            class="timesheet-grid__cell text-center"
            :class="{ 'timesheet-grid__cell--weekend': index > 4 }"
          >
            <span class="block text-xs text-muted">{{ day.label }}</span>
            <span class="font-semibold">{{ day.day }}</span>
          </div>
          <div class="timesheet-grid__cell text-right font-medium">
            {{ t('features.timesheets.total') }}
          </div>

          <template v-for="row in groupedRows" :key="`${row.projectId}:${row.activityTypeId}`">
            <div class="timesheet-grid__cell timesheet-grid__identity">
              <span class="timesheet-grid__client">{{ row.clientName }}</span>
              <span class="timesheet-grid__project">{{ row.projectName }}</span>
              <span class="timesheet-grid__activity">{{ row.activityName }}</span>
            </div>
            <button
              v-for="(day, index) in weekDays"
              :key="day.value"
              type="button"
              class="timesheet-grid__cell timesheet-row-action text-center hover:bg-elevated"
              :class="{ 'timesheet-grid__cell--weekend': index > 4 }"
              :disabled="!editable"
              :aria-label="`${t('features.timesheets.addEntry')}: ${row.label}, ${day.label} ${day.day}`"
              @click="openRowCell(row, day.value)"
            >
              <span>{{ formatDuration(row.entries.filter(entry => entry.entryDate === day.value).reduce((sum, entry) => sum + entry.durationMinutes, 0)) }}</span>
              <UBadge
                v-if="row.entries.filter(entry => entry.entryDate === day.value).length > 1"
                class="ml-1"
                color="neutral"
                variant="subtle"
                size="sm"
              >
                {{ row.entries.filter(entry => entry.entryDate === day.value).length }}
              </UBadge>
            </button>
            <div class="timesheet-grid__cell text-right font-semibold">
              {{ formatDuration(row.entries.reduce((sum, entry) => sum + entry.durationMinutes, 0)) }}
            </div>
          </template>

          <div class="timesheet-grid__cell">
            <UButton
              v-if="editable"
              size="sm"
              variant="ghost"
              icon="i-lucide-plus"
              @click="openCreate()"
            >
              {{ t('features.timesheets.addEntry') }}
            </UButton>
          </div>
          <button
            v-for="(day, index) in weekDays"
            :key="`total-${day.value}`"
            type="button"
            class="timesheet-grid__cell timesheet-row-action text-center font-semibold hover:bg-elevated"
            :class="{ 'timesheet-grid__cell--weekend': index > 4 }"
            :disabled="!editable"
            :aria-label="`${totalForDate(day.value) ? t('features.timesheets.cellEntries.title') : t('features.timesheets.addEntry')}: ${day.label} ${day.day}`"
            @click="openDayCell(day.value)"
          >
            {{ formatDuration(totalForDate(day.value)) }}
          </button>
          <div class="timesheet-grid__cell text-right text-base font-semibold">
            {{ formatDuration(totalMinutes) }}
          </div>
        </div>
      </div>
    </UCard>

    <section class="timesheet-mobile xl:hidden" :aria-label="t('features.timesheets.projectActivity')">
      <div v-if="pending" class="timesheet-mobile__loading text-muted">
        {{ t('features.timesheets.loading') }}
      </div>
      <template v-else>
        <div class="timesheet-mobile__days" role="tablist" :aria-label="t('features.timesheets.projectActivity')">
          <button
            v-for="(day, index) in weekDays"
            :key="day.value"
            type="button"
            role="tab"
            class="timesheet-mobile__day"
            :class="{ 'timesheet-mobile__day--active': selectedDay === day.value, 'timesheet-mobile__day--weekend': index > 4 }"
            :aria-selected="selectedDay === day.value"
            @click="selectedDay = day.value"
          >
            <span>{{ day.label }}</span>
            <strong>{{ day.day }}</strong>
            <small>{{ formatDuration(totalForDate(day.value)) }}</small>
          </button>
        </div>

        <div class="timesheet-mobile__summary">
          <div>
            <p class="timesheet-mobile__date">
              {{ weekDays.find(day => day.value === selectedDay)?.label }} {{ weekDays.find(day => day.value === selectedDay)?.day }}
            </p>
            <p class="text-sm text-muted">
              {{ t('features.timesheets.mobile.entryCount', selectedDayEntries.length) }}
            </p>
          </div>
          <div class="timesheet-mobile__day-total">
            <span>{{ t('features.timesheets.mobile.dayTotal') }}</span>
            <strong class="timesheet-mobile__total">{{ formatDuration(selectedDayTotal) }}</strong>
          </div>
        </div>

        <div v-if="selectedDayEntries.length" class="timesheet-mobile__entries">
          <button
            v-for="entry in selectedDayEntries"
            :key="entry.id"
            type="button"
            class="timesheet-mobile__entry timesheet-row-action"
            :disabled="!editable"
            :aria-label="`${t('features.timesheets.editEntry')}: ${entry.projectName}, ${entry.activityName}${entry.note ? `, ${entry.note}` : ''}`"
            @click="openEdit(entry)"
          >
            <span class="timesheet-mobile__entry-copy">
              <small>{{ entry.clientName }}</small>
              <strong>{{ entry.projectName }}</strong>
              <span>{{ entry.activityName }}</span>
              <span v-if="entry.note" class="timesheet-mobile__entry-note">{{ entry.note }}</span>
            </span>
            <span class="timesheet-mobile__entry-meta">
              <UIcon name="i-lucide-pencil" class="timesheet-mobile__edit-cue" aria-hidden="true" />
              <span class="timesheet-mobile__duration">{{ formatDuration(entry.durationMinutes) }}</span>
            </span>
          </button>
        </div>
        <div v-else class="timesheet-mobile__empty">
          <p>{{ t('features.timesheets.mobile.empty') }}</p>
          <span>{{ t('features.timesheets.mobile.emptyDescription') }}</span>
        </div>

        <UButton
          v-if="editable"
          class="timesheet-mobile__add"
          size="lg"
          variant="soft"
          icon="i-lucide-plus"
          block
          @click="openCreate(selectedDay)"
        >
          {{ t('features.timesheets.addEntry') }}
        </UButton>
      </template>
    </section>

    <footer class="flex items-center gap-3">
      <UBadge :color="week?.status === 'APPROVED' ? 'success' : week?.status === 'REJECTED' ? 'error' : 'neutral'">
        {{ t(`features.timesheets.status.${(week?.status ?? 'DRAFT').toLowerCase()}`) }}
      </UBadge>
      <div class="ml-auto flex items-center gap-3">
        <UButton v-if="editable" icon="i-lucide-send" size="sm" :disabled="!totalMinutes || !!runningEntry" @click="submit">
          {{ t('features.timesheets.submit') }}
        </UButton>
        <div class="text-right">
          <p class="text-xs font-medium text-muted">
            {{ t('features.timesheets.weekTotal') }}
          </p>
          <p class="text-xl font-semibold tabular-nums text-primary">
            {{ formatDuration(totalMinutes) }}
          </p>
        </div>
      </div>
    </footer>

    <UModal v-model:open="modalOpen" :title="form.id ? t('features.timesheets.editEntry') : t('features.timesheets.addEntry')">
      <template #body>
        <UAlert v-if="!isOrganizationAdmin && workspaceStructureIncomplete" color="warning" icon="i-lucide-hourglass" :title="t('features.timesheets.setup.waitingTitle')" :description="t('features.timesheets.setup.waitingDescription')" variant="outline" />
        <UForm v-else :state="form" :schema="entrySchema" class="space-y-4" @submit="saveEntry">
          <UFormField name="projectId" :label="t('features.timesheets.fields.project')" required>
            <USelect v-model="form.projectId" :items="projectOptions" value-key="value" class="w-full" @update:model-value="form.activityTypeId = ''" />
          </UFormField>
          <UFormField name="activityTypeId" :label="t('features.timesheets.fields.activity')" required>
            <USelect v-model="form.activityTypeId" :items="activityOptions" value-key="value" class="w-full" />
          </UFormField>
          <UAlert v-if="selectedProjectNeedsTariff" color="warning" icon="i-lucide-badge-alert" :title="t('features.timesheets.errors.tariffRequiredTitle')" :description="t(isOrganizationAdmin ? 'features.timesheets.errors.tariffRequiredAdmin' : 'features.timesheets.errors.tariffRequiredMember')" variant="outline">
            <template v-if="isOrganizationAdmin" #actions><UButton to="/admin/timesheets/rates" size="sm" color="warning">{{ t('features.timesheets.errors.configureRates') }}</UButton></template>
          </UAlert>
          <UFormField name="entryDate" :label="t('features.timesheets.fields.date')" required>
            <UInput v-model="form.entryDate" type="date" class="w-full" />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField name="hours" :label="t('features.timesheets.fields.hours')" required>
              <UInput v-model.number="form.hours" type="number" min="0" max="24" class="w-full" />
            </UFormField>
            <UFormField name="minutes" :label="t('features.timesheets.fields.minutes')" required>
              <UInput v-model.number="form.minutes" type="number" min="0" max="59" class="w-full" />
            </UFormField>
          </div>
          <UFormField name="note" :label="t('features.timesheets.fields.note')">
            <UTextarea v-model="form.note" :rows="3" class="w-full" />
          </UFormField>
          <div class="flex justify-between gap-3">
            <UButton v-if="form.id" type="button" color="error" variant="ghost" icon="i-lucide-trash-2" @click="removeEntry">
              {{ t('features.timesheets.delete') }}
            </UButton>
            <div class="ml-auto flex gap-2">
              <UButton type="button" color="neutral" variant="outline" @click="modalOpen = false">
                {{ t('features.timesheets.cancel') }}
              </UButton>
              <UButton type="submit" :loading="saving" :disabled="tariffMissing">
                {{ t('features.timesheets.save') }}
              </UButton>
            </div>
          </div>
        </UForm>
      </template>
    </UModal>

    <UModal v-model:open="cellEntriesOpen" :title="t('features.timesheets.cellEntries.title')">
      <template #body>
        <div v-if="selectedCell" class="space-y-4">
          <div>
            <p v-if="selectedCell.row" class="font-medium text-highlighted">
              {{ selectedCell.row.clientName }} · {{ selectedCell.row.projectName }}
            </p>
            <p class="text-sm text-muted">
              {{ selectedCell.row ? `${selectedCell.row.activityName} · ` : '' }}{{ selectedCell.date }}
            </p>
          </div>
          <div class="divide-y divide-default overflow-hidden rounded-lg border border-default">
            <button
              v-for="entry in selectedCell.entries"
              :key="entry.id"
              type="button"
              class="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-elevated"
              @click="openEdit(entry)"
            >
              <span class="min-w-0 flex-1">
                <strong v-if="!selectedCell.row" class="block truncate text-sm">
                  {{ entryProject(entry)?.name }} · {{ entryActivity(entry)?.name }}
                </strong>
                <span class="block truncate text-sm text-muted">
                  {{ entry.note || t('features.timesheets.cellEntries.noNote') }}
                </span>
              </span>
              <strong class="tabular-nums">{{ formatDuration(entry.durationMinutes) }}</strong>
              <UIcon name="i-lucide-pencil" class="size-4 text-muted" aria-hidden="true" />
            </button>
          </div>
          <div class="flex justify-end">
            <UButton icon="i-lucide-plus" variant="soft" @click="addToSelectedCell">
              {{ t('features.timesheets.cellEntries.addAnother') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="timerModalOpen" :title="t('features.timesheets.timer.start')">
      <template #body>
        <UAlert v-if="!isOrganizationAdmin && workspaceStructureIncomplete" color="warning" icon="i-lucide-hourglass" :title="t('features.timesheets.setup.waitingTitle')" :description="t('features.timesheets.setup.waitingDescription')" variant="outline" />
        <UForm v-else :state="form" :schema="timerSchema" class="space-y-4" @submit="startTimer">
          <UFormField name="projectId" :label="t('features.timesheets.fields.project')" required>
            <USelect v-model="form.projectId" :items="projectOptions" value-key="value" class="w-full" @update:model-value="form.activityTypeId = ''" />
          </UFormField>
          <UFormField name="activityTypeId" :label="t('features.timesheets.fields.activity')" required>
            <USelect v-model="form.activityTypeId" :items="activityOptions" value-key="value" class="w-full" />
          </UFormField>
          <UAlert v-if="selectedProjectNeedsTariff" color="warning" icon="i-lucide-badge-alert" :title="t('features.timesheets.errors.tariffRequiredTitle')" :description="t(isOrganizationAdmin ? 'features.timesheets.errors.tariffRequiredAdmin' : 'features.timesheets.errors.tariffRequiredMember')" variant="outline">
            <template v-if="isOrganizationAdmin" #actions><UButton to="/admin/timesheets/rates" size="sm" color="warning">{{ t('features.timesheets.errors.configureRates') }}</UButton></template>
          </UAlert>
          <UFormField name="note" :label="t('features.timesheets.fields.note')">
            <UInput v-model="form.note" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton type="button" color="neutral" variant="outline" @click="timerModalOpen = false">
              {{ t('features.timesheets.cancel') }}
            </UButton>
            <UButton type="submit" color="success" icon="i-lucide-play" :loading="saving" :disabled="tariffMissing">
              {{ t('features.timesheets.timer.start') }}
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>
  </TimesheetsPageShell>
</template>
