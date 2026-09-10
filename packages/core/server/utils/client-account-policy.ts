/** Optional client package policies; core remains usable without Clients. */
type AccountPolicy = {
  isPersonal: (organizationId: string) => Promise<boolean>
  assertAcceptance: (organizationId: string, userId: string) => Promise<void>
}
let policy: AccountPolicy | undefined
export const registerClientAccountPolicy = (value: AccountPolicy) => {
  policy = value
}
export const isPersonalClient = async (id: string) => (policy ? policy.isPersonal(id) : false)
export const assertClientInvitationAcceptance = async (id: string, userId: string) => {
  await policy?.assertAcceptance(id, userId)
}
