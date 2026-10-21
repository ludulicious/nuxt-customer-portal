import { admin } from '../../../../utils/access'
import { savePageText } from '../../../../utils/page-texts'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  setHeader(event, 'Cache-Control', 'private, no-store')
  return savePageText(organizationId, await readBody(event))
})
