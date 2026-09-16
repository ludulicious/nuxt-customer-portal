import { defineEventHandler, getQuery } from 'h3'
import { z } from 'zod'
import { parseInput } from '@nuxt-customer-portal/products/server/utils/validation'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import { providerAccess } from '@nuxt-customer-portal/planning/server/utils/access'
import { externalBusyDetails } from '@nuxt-customer-portal/planning/server/utils/adapters'

const querySchema = z
  .object({ from: z.iso.datetime({ offset: true }), to: z.iso.datetime({ offset: true }) })
  .refine(
    ({ from, to }) => Date.parse(to) > Date.parse(from) && Date.parse(to) - Date.parse(from) <= 14 * 86400000,
    'Choose a range of at most 14 days'
  )

export default defineEventHandler(async (event) => {
  const { storeId, userId } = await providerAccess(event)
  const query = parseInput(querySchema, getQuery(event))
  const [provider] = await rows<{ busy_calendar_ids: string[]; write_calendar_id: string | null }>(
    'SELECT busy_calendar_ids,write_calendar_id FROM planning.provider WHERE store_id=$1 AND user_id=$2',
    [storeId, userId]
  )
  const calendarIds = [
    ...new Set([...(provider?.busy_calendar_ids || []), provider?.write_calendar_id].filter(Boolean))
  ] as string[]
  if (!calendarIds.length) {
    return []
  }
  return externalBusyDetails(storeId, userId, calendarIds, new Date(query.from), new Date(query.to))
})
