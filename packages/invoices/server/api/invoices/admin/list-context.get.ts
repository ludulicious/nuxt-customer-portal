import { and, asc, eq, isNull } from 'drizzle-orm'
import { db, requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { organization } from '@nuxt-customer-portal/core/schema'
import { clientProfile } from '@nuxt-customer-portal/clients/server/db/schema/clients'
import { invoicesFeature } from '@nuxt-customer-portal/invoices/shared/feature'
import { invoiceSenderDetailsComplete } from '@nuxt-customer-portal/invoices/shared/invoice-sender'
import { getInvoiceSettings } from '@nuxt-customer-portal/invoices/server/utils/invoice-repository'

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, invoicesFeature.policy, 'manage')
  const [settings, clients] = await Promise.all([
    getInvoiceSettings(organizationId),
    db
      .select({ organizationId: organization.id, name: organization.name })
      .from(organization)
      .innerJoin(clientProfile, eq(clientProfile.organizationId, organization.id))
      .where(and(eq(organization.organizationType, 'CLIENT'), isNull(clientProfile.archivedAt)))
      .orderBy(asc(organization.name), asc(organization.id))
  ])
  return { clients, canCreate: invoiceSenderDetailsComplete(settings) }
})
