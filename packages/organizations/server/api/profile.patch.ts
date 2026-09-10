import { runUserDisplayNameChangedHooks } from '@nuxt-customer-portal/core/server/utils/business-hooks'
import { defineEventHandler, createError, readBody } from 'h3'
import { z } from 'zod'
import { timezoneSchema } from '@nuxt-customer-portal/core/server/utils/timezone-validation'
import { auth } from '@nuxt-customer-portal/core/server/utils/auth'
import { db } from '@nuxt-customer-portal/core/server/utils/db'
import { user as userTable } from '@nuxt-customer-portal/core/server/db/schema/auth-schema'
import { eq } from 'drizzle-orm'
import type { SessionUser } from '@nuxt-customer-portal/core/shared/types/index'

defineRouteMeta({
  openAPI: {
    tags: ['General'],
    operationId: 'generalProfilePatch',
    summary: 'Update the current user profile',
    description:
      'Update the current user profile. Uses the current authenticated session and enforces the relevant portal permissions.'
  }
})

// Zod schema for profile update request
const updateProfileSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    timezone: timezoneSchema.nullable().optional(),
    name: z
      .string()
      .trim()
      .min(1, 'Name must be a non-empty string')
      .max(255, 'Name must be less than 255 characters')
      .optional(),
    image: z
      .union([z.string().url('Image must be a valid URL'), z.literal('').transform(() => null), z.null()])
      .optional()
  })
  .refine((data) => (data.firstName === undefined) === (data.lastName === undefined), {
    message: 'Provide both first and last name'
  })
  .refine(
    (data) =>
      data.firstName !== undefined ||
      data.name !== undefined ||
      data.image !== undefined ||
      data.timezone !== undefined,
    {
      message: 'At least one field (name or image) must be provided'
    }
  )

interface UpdateProfileResponse {
  success: boolean
  message: string
  user?: {
    id: string
    name: string
    firstName: string | null
    lastName: string | null
    email: string
    image: string | null
    timezone: string | null
  }
}

export default defineEventHandler(async (event): Promise<UpdateProfileResponse> => {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session?.user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const user = session.user as SessionUser
  const body = await readBody(event)

  // Validate request body with Zod
  const validationResult = updateProfileSchema.safeParse(body)
  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0]
    throw createError({
      statusCode: 400,
      message: firstError?.message || 'Validation failed'
    })
  }

  const validatedData = validationResult.data

  // Build update object
  const updateData: {
    name?: string
    firstName?: string | null
    lastName?: string | null
    image?: string | null
    timezone?: string | null
  } = {}
  if (validatedData.timezone !== undefined) {
    updateData.timezone = validatedData.timezone
  }
  if (validatedData.name !== undefined) {
    updateData.name = validatedData.name.trim()
  }
  if (validatedData.firstName !== undefined && validatedData.lastName !== undefined) {
    updateData.firstName = validatedData.firstName
    updateData.lastName = validatedData.lastName
  }
  if (validatedData.image !== undefined) {
    updateData.image = validatedData.image
  }

  // Save the profile and linked private client names atomically.
  const updatedUser = await db.transaction(async (tx) => {
    const [updated] = await tx.update(userTable).set(updateData).where(eq(userTable.id, user.id)).returning({
      id: userTable.id,
      name: userTable.name,
      firstName: userTable.firstName,
      lastName: userTable.lastName,
      email: userTable.email,
      image: userTable.image,
      timezone: userTable.timezone
    })
    if (updated && updateData.name !== undefined) {
      await runUserDisplayNameChangedHooks(tx, user.id, updated.name)
    }
    return updated
  })

  if (!updatedUser) {
    throw createError({ statusCode: 500, message: 'Failed to update profile' })
  }

  return {
    success: true,
    message: 'Profile updated successfully',
    user: {
      id: updatedUser.id,
      name: updatedUser.name,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      email: updatedUser.email,
      image: updatedUser.image,
      timezone: updatedUser.timezone
    }
  }
})
