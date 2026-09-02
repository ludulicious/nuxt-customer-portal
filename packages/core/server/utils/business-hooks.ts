type TimeEntryReopenGuard = (organizationId: string, entryIds: string[]) => Promise<void>
const reopenGuards: TimeEntryReopenGuard[] = []

type ClientCreatedHook = (transaction: unknown, clientOrganizationId: string) => Promise<void>
const clientCreatedHooks: ClientCreatedHook[] = []

export const registerClientCreatedHook = (hook: ClientCreatedHook) => {
  if (!clientCreatedHooks.includes(hook)) {
    clientCreatedHooks.push(hook)
  }
}

export const runClientCreatedHooks = async (transaction: unknown, clientOrganizationId: string) => {
  for (const hook of clientCreatedHooks) {
    await hook(transaction, clientOrganizationId)
  }
}

export const registerTimeEntryReopenGuard = (guard: TimeEntryReopenGuard) => {
  if (!reopenGuards.includes(guard)) {
    reopenGuards.push(guard)
  }
}
export const assertTimeEntriesReopenable = async (organizationId: string, entryIds: string[]) => {
  for (const guard of reopenGuards) {
    await guard(organizationId, entryIds)
  }
}
