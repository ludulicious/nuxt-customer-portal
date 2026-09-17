/** Optional client package policies; core remains usable without Clients. */
type AccountPolicy = {
  isPersonal: (organizationId: string) => Promise<boolean>
  assertAcceptance: (organizationId: string, userId: string) => Promise<void>
  getIdentity: (organizationId: string) => Promise<{ name: string; firstName?: string; lastName?: string } | null>
}
let policy: AccountPolicy | undefined
export const registerClientAccountPolicy = (value: AccountPolicy) => {
  policy = value
}
export const isPersonalClient = async (id: string) => (policy ? policy.isPersonal(id) : false)
export const assertClientInvitationAcceptance = async (id: string, userId: string) => {
  await policy?.assertAcceptance(id, userId)
}
export const getClientAccountIdentity = async (id: string) => (policy ? policy.getIdentity(id) : null)
