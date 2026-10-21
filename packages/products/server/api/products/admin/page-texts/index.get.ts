import { admin } from '../../../../utils/access'
import { pageTexts } from '../../../../utils/page-texts'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  setHeader(event, 'Cache-Control', 'private, no-store')
  return pageTexts(organizationId)
})
