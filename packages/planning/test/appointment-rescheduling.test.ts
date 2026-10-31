import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { transpileModule, ModuleKind } from 'typescript'
import { computed, ref, watch } from 'vue'

const detailsSource = await readFile(
  new URL('../app/components/PlanningAppointmentDetails.vue', import.meta.url),
  'utf8'
)
const drawerSource = await readFile(new URL('../app/components/PlanningAppointmentDrawer.vue', import.meta.url), 'utf8')
const original = {
  id: 'appointment',
  productId: 'product',
  productSlug: 'service',
  title: 'Service',
  start: '2026-11-02T09:00:00.000Z',
  end: '2026-11-02T09:30:00.000Z',
  providerUserId: 'old-provider',
  providerName: 'Original host',
  providerEmail: 'old@example.test',
  status: 'confirmed',
  revision: 3,
  staff: true,
  canReschedule: true,
  customerTimezone: 'UTC'
}
const slot = {
  start: '2026-11-10T08:30:00.000Z',
  end: '2026-11-10T09:00:00.000Z',
  providerUserId: 'new-provider',
  providerName: 'New host'
}
const updated = { ...original, ...slot, providerEmail: 'new@example.test', revision: 4 }

async function setup(source: string, bindings: Record<string, unknown>, exposed: string) {
  const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script)
  const code = transpileModule(script.replace(/^import .*$/gm, ''), {
    compilerOptions: { module: ModuleKind.ESNext }
  }).outputText
  return runInNewContext(`(async () => { ${code}; return { ${exposed} } })()`, {
    ref,
    computed,
    watch,
    defineProps: () => ({ id: original.id, item: original }),
    withDefaults: (props: unknown) => props,
    useI18n: () => ({ t: (key: string) => key, locale: ref('en') }),
    usePlanningTimeDisplay: () => ({ appointmentRange: () => '' }),
    ...bindings
  })
}

async function details(save: () => Promise<void> = async () => {}) {
  const calls: unknown[][] = [],
    events: unknown[][] = [],
    toasts: unknown[] = []
  let saved = false
  const state = await setup(
    detailsSource,
    {
      defineEmits:
        () =>
        (...args: unknown[]) =>
          events.push(args),
      useToast: () => ({ add: (toast: unknown) => toasts.push(toast) }),
      usePlanning: () => ({
        appointment: async () => (saved ? updated : original),
        staffReschedule: async (...args: unknown[]) => {
          calls.push(args)
          await save()
          saved = true
        }
      })
    },
    'selected, confirmChange, openChange, changeOpen, pendingChange, busy, error, item'
  )
  return { state, calls, events, toasts }
}

test('staff slot selection requires explicit confirmation before saving', async () => {
  const { state, calls, events, toasts } = await details()
  state.openChange()
  state.selected(slot, 'Europe/Amsterdam')
  assert.equal(state.changeOpen.value, true)
  assert.equal(state.pendingChange.value.slot.start, slot.start)
  assert.equal(calls.length, 0)
  assert.equal(events.length, 0)
  await state.confirmChange()
  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.[0], original.id)
  assert.deepEqual(
    { ...(calls[0]?.[1] as object) },
    {
      providerUserId: slot.providerUserId,
      start: slot.start,
      customerTimezone: 'Europe/Amsterdam',
      revision: original.revision
    }
  )
  assert.equal(state.changeOpen.value, false)
  assert.equal(state.item.value.start, slot.start)
  assert.equal(events[0]?.[0], 'changed')
  assert.equal((events[0]?.[1] as typeof updated).revision, 4)
  assert.equal(toasts.length, 1)
})

test('closing and reopening discards a staged change without saving', async () => {
  const { state, calls } = await details()
  state.openChange()
  state.selected(slot, 'UTC')
  state.changeOpen.value = false
  state.openChange()
  assert.equal(state.pendingChange.value, undefined)
  await state.confirmChange()
  assert.equal(calls.length, 0)
})

test('failed staff changes keep confirmation open and allow retry', async () => {
  let attempts = 0
  const { state, calls, events, toasts } = await details(async () => {
    if (++attempts === 1) {
      throw new Error('Slot unavailable')
    }
  })
  state.openChange()
  state.selected(slot, 'UTC')
  await state.confirmChange()
  assert.equal(state.changeOpen.value, true)
  assert.equal(state.error.value, 'planning.actionError')
  assert.equal(state.busy.value, false)
  assert.equal(events.length, 0)
  assert.equal(toasts.length, 0)
  await state.confirmChange()
  assert.equal(calls.length, 2)
  assert.equal(state.error.value, '')
  assert.equal(state.changeOpen.value, false)
})

test('confirmation blocks duplicate requests while the save is pending', async () => {
  let finish!: () => void
  const { state, calls } = await details(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      })
  )
  state.openChange()
  state.selected(slot, 'UTC')
  const saving = state.confirmChange()
  await state.confirmChange()
  assert.equal(state.busy.value, true)
  assert.equal(calls.length, 1)
  finish()
  await saving
  assert.equal(state.busy.value, false)
})

test('drawer shows saved appointment details without waiting for the list refresh', async () => {
  const events: unknown[][] = []
  const state = await setup(
    drawerSource,
    {
      defineModel: () => ref(true),
      defineEmits:
        () =>
        (...args: unknown[]) =>
          events.push(args),
      usePlanning: () => ({ appointmentFiles: async () => [] })
    },
    'changed, item'
  )
  state.changed(updated)
  assert.equal(state.item.value.start, slot.start)
  assert.equal(state.item.value.providerName, slot.providerName)
  assert.equal(state.item.value.providerEmail, updated.providerEmail)
  assert.equal(events[0]?.[0], 'changed')
})

test('confirmation and errors are rendered within the reschedule modal', () => {
  assert.match(detailsSource, /<UModal v-if="changeOpen" v-model:open="changeOpen"/)
  assert.match(detailsSource, /:dismissible="!busy"/)
  assert.match(detailsSource, /<template #body\s*><UAlert v-if="error"/)
  assert.match(detailsSource, /v-if="pendingChange"/)
  assert.match(detailsSource, /@click="confirmChange"/)
  assert.match(detailsSource, /:select-only="item.staff"/)
  assert.match(detailsSource, /@reserved="reserved"/)
})
