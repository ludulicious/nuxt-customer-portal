type TimeEntryReopenGuard = (organizationId: string, entryIds: string[]) => Promise<void>
const reopenGuards: TimeEntryReopenGuard[] = []
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
