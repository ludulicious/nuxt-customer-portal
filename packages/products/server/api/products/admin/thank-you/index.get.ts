import { admin } from '../../../../utils/access'
import { thankYouTexts } from '../../../../utils/thank-you'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  setHeader(event, 'Cache-Control', 'private, no-store')
  return thankYouTexts(organizationId)
})
