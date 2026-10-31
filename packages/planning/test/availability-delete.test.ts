import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const page = readFileSync(new URL('../app/pages/availability.vue', import.meta.url), 'utf8')
const handler = page.match(/async function removeWindow[\s\S]+?(?=\n<\/script>)/)![0]
const source = ts.transpileModule('export ' + handler, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText

function harness(editOccurrence: boolean, fail = false) {
  const calls: Array<{ id: string; occurrence?: string }> = []
  const state = {
    canEditCalendar: { value: true },
    selected: { value: { id: 'series', recurring: true } as { id: string; recurring: boolean } | undefined },
    occurrence: { value: '2026-11-02' },
    editOne: { value: editOccurrence },
    busy: { value: false },
    error: { value: '' },
    deleteOpen: { value: true },
    windowOpen: { value: true }
  }
  let reloads = 0
  const exports = {} as { removeWindow(scope: 'occurrence' | 'series'): Promise<void> }
  runInNewContext(source, {
    exports,
    ...state,
    api: {
      deleteWindow: async (id: string, occurrence?: string) => {
        calls.push({ id, occurrence })
        if (fail) {
          throw new Error('Delete failed')
        }
      }
    },
    load: async () => {
      reloads++
    },
    t: (key: string) => key
  })
  return { state, calls, remove: exports.removeWindow, reloads: () => reloads }
}

test('occurrence and series actions ignore the editor occurrence-only toggle', async () => {
  for (const editOccurrence of [false, true]) {
    for (const scope of ['occurrence', 'series'] as const) {
      const fixture = harness(editOccurrence)
      await fixture.remove(scope)
      assert.deepEqual(fixture.calls, [{ id: 'series', occurrence: scope === 'occurrence' ? '2026-11-02' : undefined }])
      assert.equal(fixture.state.deleteOpen.value, false)
      assert.equal(fixture.state.windowOpen.value, false)
      assert.equal(fixture.state.selected.value?.id, 'series')
      assert.equal(fixture.state.busy.value, false)
      assert.equal(fixture.reloads(), 1)
    }
  }
})

test('failed deletion retains both dialogs and the selected availability for retry', async () => {
  const fixture = harness(false, true)
  await fixture.remove('occurrence')
  assert.equal(fixture.state.deleteOpen.value, true)
  assert.equal(fixture.state.windowOpen.value, true)
  assert.equal(fixture.state.error.value, 'planning.actionError')
  assert.equal(fixture.state.busy.value, false)
  assert.equal(fixture.reloads(), 0)
})

test('deletion requires an editable calendar and a selected window', async () => {
  for (const missingSelection of [false, true]) {
    const fixture = harness(false)
    if (missingSelection) {
      fixture.state.selected.value = undefined
    } else {
      fixture.state.canEditCalendar.value = false
    }
    await fixture.remove('series')
    assert.equal(fixture.calls.length, 0)
    assert.equal(fixture.state.deleteOpen.value, true)
  }
})

test('delete dialog exposes explicit scopes and cancellation without changing editor state', () => {
  const dialog = page.match(/<UModal v-if="deleteOpen"[\s\S]+?<\/UModal>/)![0]
  assert.match(dialog, /v-model:open="deleteOpen"/)
  assert.match(dialog, /v-if="selected\?\.recurring"/)
  assert.match(dialog, /@click="removeWindow\('occurrence'\)"/)
  assert.match(dialog, /@click="removeWindow\('series'\)"/)
  assert.match(dialog, /@click="deleteOpen = false"/)
  assert.match(dialog, /planning\.cancelAction/)
  assert.doesNotMatch(dialog, /editOne|selected\s*=|windowOpen\s*=/)
  for (const locale of ['en', 'nl']) {
    const messages = JSON.parse(readFileSync(new URL('../i18n/locales/' + locale + '.json', import.meta.url), 'utf8'))
    for (const key of [
      'deleteThisOccurrence',
      'deleteSeries',
      'deleteWindowConfirm',
      'deleteSeriesConfirm',
      'cancelAction'
    ]) {
      assert.ok(messages.planning[key], locale + ': ' + key)
    }
  }
})
