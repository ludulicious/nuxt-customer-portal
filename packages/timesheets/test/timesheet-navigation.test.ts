import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
import type { TimesheetCapabilitiesDto } from '../shared/types/timesheet'
import type { PortalFeatureDefinition } from '@nuxt-customer-portal/core/shared/types/feature'

const compile = (source: string) =>
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
const featureContext = {
  exports: {} as { timesheetsFeature: PortalFeatureDefinition },
  require: () => ({ timesheetEmails: [] })
}
runInNewContext(compile(readFileSync(new URL('../shared/feature.ts', import.meta.url), 'utf8')), featureContext)
const feature = featureContext.exports.timesheetsFeature
const plugin = compile(
  readFileSync(new URL('../app/plugins/timesheets-feature.ts', import.meta.url), 'utf8').replaceAll(
    'import.meta.client',
    'false'
  )
)
const capabilities: TimesheetCapabilitiesDto = {
  internalApprovalsEnabled: true,
  canEnterTime: true,
  canApproveInternalTimesheets: false,
  hasInternalApprovalAssignments: false,
  canManageTimesheets: true,
  canReviewClientTimesheets: false,
  canViewSupplierTime: false,
  canAccessApprovals: false,
  canManageClientReviewers: false,
  pendingInternalApprovalCount: 0,
  pendingClientApprovalCount: 0,
  unassignedClientReviewerSupplierCount: 0
}

const register = async (values: Partial<TimesheetCapabilitiesDto>) => {
  let registered: PortalFeatureDefinition | undefined
  let refresh: Promise<void> | undefined
  const context = {
    exports: {},
    require: () => ({ timesheetsFeature: feature }),
    defineNuxtPlugin: (setup: () => void) => setup(),
    usePortalFeatures: () => ({
      registerFeature: (value: PortalFeatureDefinition) => {
        registered = value
      }
    }),
    usePortalSession: () => ({ activeOrganizationId: { value: 'workspace' } }),
    $fetch: async () => ({ ...capabilities, ...values }),
    watch: (_source: unknown, callback: (id: string) => Promise<void>) => {
      refresh = callback('workspace')
    }
  }
  runInNewContext(plugin, context)
  await refresh
  return registered!
}

test('time entry stays visible when internal approvals are disabled without granting queue access', async () => {
  const enabled = await register({ internalApprovalsEnabled: true })
  assert.ok(enabled.modules![0]!.menuItems!.some((item) => item.id === 'my-timesheet'))
  assert.equal(
    enabled.modules![0]!.menuItems!.some((item) => item.id === 'timesheet-approvals'),
    false
  )
  const disabled = await register({ internalApprovalsEnabled: false })
  assert.equal(
    disabled.modules![0]!.menuItems!.some((item) => item.id === 'my-timesheet'),
    true
  )
  assert.equal(
    disabled.navigation!.some((item) => item.id === 'timesheets'),
    true
  )
  assert.equal(disabled.modules![0]!.to, '/timesheets')
  const member = await register({ internalApprovalsEnabled: false, canManageTimesheets: false })
  assert.equal(member.modules![0]!.to, '/timesheets')
})

test('only assigned approvers see the internal approval queue while enabled', async () => {
  for (const enabled of [false, true]) {
    const result = await register({ internalApprovalsEnabled: enabled, canApproveInternalTimesheets: true })
    assert.equal(
      result.modules![0]!.menuItems!.some((item) => item.id === 'timesheet-approvals'),
      enabled
    )
    assert.equal(
      result.navigation!.some((item) => item.id === 'timesheets-approvals'),
      enabled
    )
  }
})
