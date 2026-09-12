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

type UserDisplayNameChangedHook = (transaction: unknown, userId: string, name: string) => Promise<void>
const userDisplayNameChangedHooks: UserDisplayNameChangedHook[] = []
export const registerUserDisplayNameChangedHook = (hook: UserDisplayNameChangedHook) => {
  if (!userDisplayNameChangedHooks.includes(hook)) {
    userDisplayNameChangedHooks.push(hook)
  }
}
export const runUserDisplayNameChangedHooks = async (transaction: unknown, userId: string, name: string) => {
  for (const hook of userDisplayNameChangedHooks) {
    await hook(transaction, userId, name)
  }
}

type UserIdentityChangedHook = (
  transaction: unknown,
  userId: string,
  identity: { firstName: string | null; lastName: string | null }
) => Promise<void>
const userIdentityChangedHooks: UserIdentityChangedHook[] = []
export const registerUserIdentityChangedHook = (hook: UserIdentityChangedHook) => {
  if (!userIdentityChangedHooks.includes(hook)) {
    userIdentityChangedHooks.push(hook)
  }
}
export const runUserIdentityChangedHooks = async (
  transaction: unknown,
  userId: string,
  identity: { firstName: string | null; lastName: string | null }
) => {
  for (const hook of userIdentityChangedHooks) {
    await hook(transaction, userId, identity)
  }
}
