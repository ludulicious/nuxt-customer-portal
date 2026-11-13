import { z } from 'zod'
import { isPortalDemo } from '@nuxt-customer-portal/core/server/utils/demo'
import { createDemoSession, removeDemoSession } from '../../utils/demo-session'
import { demoIdentities } from '../../utils/identities'

export default defineEventHandler(async (event) => {
  if (!isPortalDemo()) {
    throw createError({ statusCode: 404 })
  }
  const { userId } = await readValidatedBody(
    event,
    z.object({ userId: z.string().refine((id) => demoIdentities.some((user) => user.id === id)) }).parse
  )
  await removeDemoSession(event)
  return createDemoSession(event, userId)
})
