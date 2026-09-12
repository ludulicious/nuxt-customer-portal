import { randomUUID } from 'node:crypto'
import type { PoolClient } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { createError } from 'h3'
import { createClientInTransaction } from './client-repository'
import { requireAllowedClientType } from './client-configuration'

export interface PurchaseClientInput {
  type: 'person' | 'organization'
  firstName: string
  lastName: string
  name: string
  email: string
  company: string
  address: string
  registrationNumber: string
  vatNumber: string
  clientId?: string
}
/** Never resolve company membership from unverified checkout fields. */
export async function provisionPurchaseClient(
  tx: PoolClient,
  input: PurchaseClientInput,
  verifiedUserId: string | null,
  actorId: string,
  locale: 'en' | 'nl'
) {
  await requireAllowedClientType(input.type)
  await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`purchase-client:${input.email}`])
  let clientId: string | undefined
  if (input.clientId && verifiedUserId) {
    const result = await tx.query<{ id: string }>(
      `SELECT p.organization_id AS id FROM clients.client_profile p JOIN public.member m ON m.organization_id=p.organization_id WHERE m.user_id=$1 AND p.organization_id=$2 AND p.client_type=$3 AND p.archived_at IS NULL`,
      [verifiedUserId, input.clientId, input.type]
    )
    if (!result.rows[0]) {
      throw createError({ statusCode: 403, message: 'Client membership required' })
    }
    clientId = result.rows[0].id
  }
  if (!clientId && input.type === 'person') {
    // Reuse an existing personal billing client without granting membership or overwriting its profile.
    const result = await tx.query<{ id: string }>(
      `SELECT p.organization_id AS id FROM clients.client_profile p JOIN public.member m ON m.organization_id=p.organization_id JOIN public."user" u ON u.id=m.user_id WHERE lower(u.email)=$1 AND p.client_type='person' AND p.archived_at IS NULL LIMIT 1`,
      [input.email]
    )
    clientId = result.rows[0]?.id
    if (!clientId) {
      const pending = await tx.query<{ id: string }>(
        `SELECT p.organization_id AS id FROM clients.client_profile p JOIN public.invitation i ON i.organization_id=p.organization_id WHERE lower(i.email)=$1 AND p.client_type='person' AND p.archived_at IS NULL AND i.status='pending' ORDER BY i.expires_at DESC LIMIT 1`,
        [input.email]
      )
      clientId = pending.rows[0]?.id
    }
  }
  if (!clientId) {
    // Use the public client creation contract and its registered hooks in this transaction.
    const database = drizzle(tx)
    clientId = await createClientInTransaction(database, actorId, {
      clientType: input.type,
      name: input.type === 'person' ? input.name : input.company,
      ...(input.type === 'person' ? { firstName: input.firstName, lastName: input.lastName } : {}),
      slug: `buyer-${randomUUID()}`,
      officialName: input.type === 'person' ? input.name : input.company,
      address: input.address,
      registrationNumber: input.type === 'organization' ? input.registrationNumber || null : null,
      vatNumber: input.type === 'organization' ? input.vatNumber || null : null,
      invoiceEmail: input.email,
      preferredLocale: locale,
      moduleIds: ['invoices']
    })
  }
  const existing = await tx.query(
    `SELECT 1 FROM public.member m JOIN public."user" u ON u.id=m.user_id WHERE m.organization_id=$1 AND lower(u.email)=$2`,
    [clientId, input.email]
  )
  let invitationId: string | null = null
  if (!existing.rowCount) {
    const pending = await tx.query<{ id: string }>(
      "SELECT id FROM public.invitation WHERE organization_id=$1 AND lower(email)=$2 AND status='pending' LIMIT 1",
      [clientId, input.email]
    )
    invitationId = pending.rows[0]?.id || randomUUID()
    await tx.query(
      `INSERT INTO public.invitation(id,organization_id,email,role,status,expires_at,inviter_id) VALUES($1,$2,$3,'owner','pending',now()+interval '7 days',$4) ON CONFLICT(id) DO UPDATE SET expires_at=now()+interval '7 days'`,
      [invitationId, clientId, input.email, actorId]
    )
  }
  return { clientId, invitationId }
}
