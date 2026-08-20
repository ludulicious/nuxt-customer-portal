export const tenantLifecycleStates = ['PENDING_EMAIL', 'PROVISIONING', 'ACTIVE', 'READ_ONLY', 'DELETION_SCHEDULED', 'ERROR', 'DELETED'] as const
export type TenantLifecycleState = typeof tenantLifecycleStates[number]

const transitions: Record<TenantLifecycleState, TenantLifecycleState[]> = {
  PENDING_EMAIL: ['PROVISIONING', 'DELETED'],
  PROVISIONING: ['ACTIVE', 'ERROR'],
  ACTIVE: ['READ_ONLY', 'ERROR'],
  READ_ONLY: ['ACTIVE', 'DELETION_SCHEDULED'],
  DELETION_SCHEDULED: ['ACTIVE', 'DELETED'],
  ERROR: ['PROVISIONING', 'DELETION_SCHEDULED'],
  DELETED: []
}

export const isTenantLifecycleState = (value: string): value is TenantLifecycleState =>
  tenantLifecycleStates.includes(value as TenantLifecycleState)

export const canTransitionTenant = (from: TenantLifecycleState, to: TenantLifecycleState) =>
  transitions[from].includes(to)
