import { requireSession, requireOrganizationContext } from '../portal'
import { getActiveOrganizationId } from '../../shared/portal-session'
import { getResolvedTimezones } from '../utils/timezones'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const context = getActiveOrganizationId(session) ? await requireOrganizationContext(session) : null
  return getResolvedTimezones(session.user.id, context?.organizationType === 'CLIENT' ? context.organizationId : null)
})
