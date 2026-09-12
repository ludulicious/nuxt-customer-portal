import { requireSession } from '@nuxt-customer-portal/core/server/portal'
import { getActiveOrganizationId } from '@nuxt-customer-portal/core/shared/portal-session'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const session = await requireSession(event)
  const { user } = session
  const organizationId = getActiveOrganizationId(session)
  const [activeOrganization, account, clientProfile, accountTypes] = await Promise.all([
    organizationId
      ? rows<{ name: string; metadata: string | null; organizationType: 'PROVIDER' | 'CLIENT' }>(
          'SELECT name,metadata,organization_type AS "organizationType" FROM public.organization WHERE id=$1 LIMIT 1',
          [organizationId]
        ).then((organizations) => organizations[0])
      : null,
    rows<{ name: string; email: string; firstName: string | null; lastName: string | null }>(
      'SELECT name,email,first_name AS "firstName",last_name AS "lastName" FROM public."user" WHERE id=$1 LIMIT 1',
      [user.id]
    ).then((accounts) => accounts[0]),
    organizationId
      ? rows<{ officialName: string; clientType: 'organization' | 'person' }>(
          'SELECT official_name AS "officialName",client_type AS "clientType" FROM clients.client_profile WHERE organization_id=$1 LIMIT 1',
          [organizationId]
        ).then((profiles) => profiles[0])
      : null,
    rows<{ organizationType: 'PROVIDER' | 'CLIENT'; clientType: 'organization' | 'person' | null }>(
      `SELECT o.organization_type AS "organizationType",p.client_type AS "clientType"
       FROM public.member m
       JOIN public.organization o ON o.id=m.organization_id
       LEFT JOIN clients.client_profile p ON p.organization_id=o.id AND p.archived_at IS NULL
       WHERE m.user_id=$1`,
      [user.id]
    )
  ])
  const accountName = account?.name || user.name || ''
  const [derivedFirstName = '', ...derivedLastName] = accountName.trim().split(/\s+/)
  const metadata = (() => {
    const value = activeOrganization?.metadata as unknown
    if (value && typeof value === 'object') {
      return value as Record<string, unknown>
    }
    try {
      return typeof value === 'string' && value ? (JSON.parse(value) as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  })()
  const officialCompanyName =
    typeof metadata.officialCompanyName === 'string' && metadata.officialCompanyName.trim()
      ? metadata.officialCompanyName.trim()
      : clientProfile?.officialName || activeOrganization?.name || ''
  const isBusinessOrganization =
    activeOrganization?.organizationType === 'PROVIDER' || clientProfile?.clientType === 'organization'
  const hasPersonalClient = accountTypes.some((accountType) => accountType.clientType === 'person')
  const hasBusinessMembership = accountTypes.some(
    (accountType) => accountType.organizationType === 'PROVIDER' || accountType.clientType === 'organization'
  )
  return {
    name: accountName,
    firstName: account?.firstName || derivedFirstName,
    lastName: account?.lastName || derivedLastName.join(' '),
    email: account?.email || user.email || '',
    buyerType: isBusinessOrganization ? ('organization' as const) : ('person' as const),
    canBuyAsBusiness: hasBusinessMembership || !hasPersonalClient,
    organizationName: isBusinessOrganization ? officialCompanyName : ''
  }
})
