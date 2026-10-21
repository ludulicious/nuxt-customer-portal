import { admin } from '../../../../utils/access'
import { resetPageText } from '../../../../utils/page-texts'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  setHeader(event, 'Cache-Control', 'private, no-store')
  await resetPageText(organizationId, await readBody(event))
  return { success: true }
})
