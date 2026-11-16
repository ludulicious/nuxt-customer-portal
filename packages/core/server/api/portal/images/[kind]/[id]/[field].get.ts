import { createError, defineEventHandler, getRouterParams } from 'h3'
import { z } from 'zod'
import { requireSession } from '@nuxt-customer-portal/core/server/portal'
import { readPortalImage } from '@nuxt-customer-portal/core/server/utils/portal-image-access'
import { portalImageResponse } from '@nuxt-customer-portal/core/server/utils/portal-image-response'

const paramsSchema = z.object({
  kind: z.enum(['user', 'organization']),
  id: z.string().min(1),
  field: z.enum(['avatar', 'logo'])
})

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const params = paramsSchema.safeParse(getRouterParams(event))
  if (!params.success) {
    throw createError({ statusCode: 404, message: 'Image not found' })
  }
  const { kind, id, field } = params.data
  const value = await readPortalImage(session, kind, id, field)
  return portalImageResponse(event, value, field)
})
