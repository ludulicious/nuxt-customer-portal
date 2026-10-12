import { nanoid } from 'nanoid'
import { eq } from 'drizzle-orm'
import { db } from '@nuxt-customer-portal/core/server/portal'
import { sendPortalEmail } from '@nuxt-customer-portal/core/server/utils/portal-email'
import { timesheetApprovalEmail } from '../db/schema/timesheets'

export const sendTrackedApprovalEmail = async (
  input: Parameters<typeof sendPortalEmail>[0],
  context: {
    submissionId: string
    clientOrganizationId: string | null
    kind: string
    recipient: { id: string; name: string; email: string }
    message: string
    requestId?: string
  }
) => {
  const idempotencyKey = context.requestId
    ? `${input.idempotencyKey}/resend/${context.requestId}`
    : input.idempotencyKey!
  // Claim before contacting the provider, so concurrent retries cannot send twice.
  const [attempt] = await db
    .insert(timesheetApprovalEmail)
    .values({
      id: nanoid(),
      submissionId: context.submissionId,
      clientOrganizationId: context.clientOrganizationId,
      kind: context.kind,
      recipientUserId: context.recipient.id,
      recipientName: context.recipient.name,
      recipientEmail: context.recipient.email,
      message: context.message,
      status: 'SENDING',
      idempotencyKey
    })
    .onConflictDoNothing({ target: timesheetApprovalEmail.idempotencyKey })
    .returning()
  if (!attempt) {
    return
  }
  let result: Awaited<ReturnType<typeof sendPortalEmail>>
  try {
    result = await sendPortalEmail({ ...input, idempotencyKey })
  } catch (error) {
    await db.update(timesheetApprovalEmail).set({ status: 'FAILED' }).where(eq(timesheetApprovalEmail.id, attempt.id))
    throw error
  }
  await db
    .update(timesheetApprovalEmail)
    .set({
      status: 'SENT',
      sentAt: new Date(),
      providerMessageId: result.id ?? null
    })
    .where(eq(timesheetApprovalEmail.id, attempt.id))
}
