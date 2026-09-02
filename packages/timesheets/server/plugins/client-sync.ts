import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { organization } from '@nuxt-customer-portal/core/schema'
import { registerClientCreatedHook } from '@nuxt-customer-portal/core/server/utils/business-hooks'
import { workspaceClient } from '@nuxt-customer-portal/timesheets/server/db/schema/timesheets'

type PortalTransaction = typeof import('@nuxt-customer-portal/core/server/portal').db

export default defineNitroPlugin(() =>
  registerClientCreatedHook(async (transaction, clientOrganizationId) => {
    const tx = transaction as PortalTransaction
    const providers = await tx
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.organizationType, 'PROVIDER'))
    if (!providers.length) {
      return
    }
    await tx
      .insert(workspaceClient)
      .values(
        providers.map((provider) => ({
          id: nanoid(),
          workspaceOrganizationId: provider.id,
          clientOrganizationId
        }))
      )
      .onConflictDoNothing()
  })
)
