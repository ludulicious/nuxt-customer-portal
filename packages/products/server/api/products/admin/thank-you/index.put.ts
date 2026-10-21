import { admin } from '../../../../utils/access'
import { getProduct } from '../../../../utils/catalog'
import { saveThankYouText } from '../../../../utils/thank-you'
import { parseInput } from '../../../../utils/validation'
import { saveThankYouSchema } from '../../../../../shared/thank-you'

export default defineEventHandler(async (event) => {
  const { organizationId } = await admin(event)
  const input = parseInput(saveThankYouSchema, await readBody(event))
  if (input.productSlug) {
    await getProduct(organizationId, input.productSlug, true)
  }
  return saveThankYouText(organizationId, input)
})
