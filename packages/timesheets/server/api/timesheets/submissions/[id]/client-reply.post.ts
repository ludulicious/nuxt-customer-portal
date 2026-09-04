import { z } from 'zod'
import { requireActiveOrganizationRole } from '@nuxt-customer-portal/core/server/portal'
import { replyClientTimesheet } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'
import { submissionReplySchema } from '@nuxt-customer-portal/timesheets/shared/submission-reply'

export default defineEventHandler(async (event) => {
  const { organizationId, session } = await requireActiveOrganizationRole(event)
  const input = submissionReplySchema
    .extend({ clientOrganizationId: z.string().min(1), expectedVersion: z.number().int().min(0) })
    .parse(await readBody(event))
  await replyClientTimesheet(
    organizationId,
    session.user.id,
    getRouterParam(event, 'id')!,
    input.clientOrganizationId,
    input.expectedVersion,
    input.reply
  )
  return { success: true }
})
