import { admin } from '../../../../utils/access'
import { resetThankYouText } from '../../../../utils/thank-you'
import { parseInput } from '../../../../utils/validation'
import { thankYouTargetSchema } from '../../../../../shared/thank-you'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  const input = parseInput(thankYouTargetSchema, await readBody(event))
  await resetThankYouText(organizationId, input)
  return { success: true }
})
