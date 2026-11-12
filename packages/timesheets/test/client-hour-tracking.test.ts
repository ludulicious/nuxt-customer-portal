import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const source = ts.createSourceFile(
  'repository.ts',
  readFileSync(new URL('../server/utils/timesheet-repository.ts', import.meta.url), 'utf8'),
  ts.ScriptTarget.Latest,
  true
)
const names = ['ensureTimesheetClientSettings', 'resolveEntryContext', 'createProject']
const selected = source.statements
  .filter(
    (statement) =>
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(
        (declaration) => ts.isIdentifier(declaration.name) && names.includes(declaration.name.text)
      )
  )
  .map((statement) => statement.getText(source))
  .join('\n')
const code = ts.transpileModule(`${selected}\nexports.resolveEntryContext = resolveEntryContext`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText
const load = (internal = false, enabled = false) => {
  const calls: string[] = []
  const exports: Record<string, (...args: unknown[]) => Promise<unknown>> = {}
  runInNewContext(code, {
    exports,
    requireClientModuleEnabled: async (id: string) => {
      calls.push(id)
      if (!enabled) {
        throw new Error('Tracking disabled')
      }
    },
    ensureSettings: async () => ({ currency: 'EUR' }),
    listProjects: async () => [
      {
        id: 'project',
        internal,
        clientOrganizationId: internal ? 'provider' : 'client',
        status: 'ACTIVE',
        activityTypeIds: ['activity']
      }
    ],
    listActivities: async () => [{ id: 'activity', active: true, billable: false }],
    db: { select: () => ({ from: () => ({ where: async () => [] }) }) },
    teamTariff: {},
    projectPersonTariff: {},
    eq: () => null,
    and: () => null,
    createError: (input: { message: string }) => new Error(input.message)
  })
  return { api: exports, calls }
}

test('disabled clients cannot create projects or register time through direct repository calls', async () => {
  const { api, calls } = load()
  await assert.rejects(api.createProject!('provider', { clientOrganizationId: 'client' }), /Tracking disabled/)
  await assert.rejects(api.resolveEntryContext!('provider', 'person', 'project', 'activity'), /Tracking disabled/)
  assert.deepEqual(calls, ['client', 'client'])
})

test('internal work requires no client module and remains available', async () => {
  const { api, calls } = load(true)
  assert.equal(await api.ensureTimesheetClientSettings!('provider', 'provider'), null)
  const context = (await api.resolveEntryContext!('provider', 'person', 'project', 'activity')) as {
    clientOrganizationId: string
    hourlyRateMinorSnapshot: number
  }
  assert.equal(context.clientOrganizationId, 'provider')
  assert.equal(context.hourlyRateMinorSnapshot, 0)
  assert.deepEqual(calls, [])
})

test('enabled hourly clients can resolve new time entry context', async () => {
  const { api, calls } = load(false, true)
  const context = (await api.resolveEntryContext!('provider', 'person', 'project', 'activity')) as {
    clientOrganizationId: string
  }
  assert.equal(context.clientOrganizationId, 'client')
  assert.deepEqual(calls, ['client'])
})
