import { z } from 'zod'
import { getStore, publicLimit } from '../../../utils/access'
import { orderPageCopy } from '../../../utils/page-texts'
import { parseInput } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Referrer-Policy', 'no-referrer')
  await publicLimit(event)
  const { locale } = parseInput(z.object({ locale: z.enum(['en', 'nl']).default('en') }), getQuery(event))
  return orderPageCopy((await getStore()).organization_id, locale)
})
