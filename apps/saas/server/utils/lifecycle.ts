export const workspaceLifecycleStates = ['PENDING_EMAIL', 'PROVISIONING', 'ACTIVE', 'READ_ONLY', 'DELETION_SCHEDULED', 'ERROR', 'DELETED'] as const
export type WorkspaceLifecycleState = typeof workspaceLifecycleStates[number]

const transitions: Record<WorkspaceLifecycleState, WorkspaceLifecycleState[]> = {
  PENDING_EMAIL: ['PROVISIONING', 'DELETED'],
  PROVISIONING: ['ACTIVE', 'ERROR'],
  ACTIVE: ['READ_ONLY', 'ERROR'],
  READ_ONLY: ['ACTIVE', 'DELETION_SCHEDULED'],
  DELETION_SCHEDULED: ['ACTIVE', 'DELETED'],
  ERROR: ['PROVISIONING', 'DELETION_SCHEDULED'],
  DELETED: []
}

export const isWorkspaceLifecycleState = (value: string): value is WorkspaceLifecycleState =>
  workspaceLifecycleStates.includes(value as WorkspaceLifecycleState)

export const canTransitionWorkspace = (from: WorkspaceLifecycleState, to: WorkspaceLifecycleState) =>
  transitions[from].includes(to)
