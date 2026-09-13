import { createError, getHeader, type H3Event } from 'h3'
import { requireActiveOrganizationRole, requireSession } from '@nuxt-customer-portal/core/server/portal'
import { admin, getStore, baseUrl } from '@nuxt-customer-portal/products/server/utils/access'
import { rows } from '@nuxt-customer-portal/products/server/utils/database'
import { claimPurchases } from '@nuxt-customer-portal/products/server/utils/orders'
import type { Appointment } from '../../shared/types'

export const planningAdmin = admin
export function sameOrigin(event: H3Event) {
  if (getHeader(event, 'origin') !== baseUrl()) {
    throw createError({ statusCode: 403, message: 'This action must originate from the portal' })
  }
}
export async function providerAccess(event: H3Event) {
  const context = await requireActiveOrganizationRole(event),
    store = await getStore()
  if (context.organizationType !== 'PROVIDER' || context.organizationId !== store.organization_id) {
    throw createError({ statusCode: 403, message: 'Provider organization membership required' })
  }
  await rows(
    `INSERT INTO planning.provider(store_id,user_id,timezone) SELECT $1,u.id,COALESCE(u.timezone,os.timezone,'Europe/Amsterdam') FROM public."user" u LEFT JOIN public.organization_settings os ON os.organization_id=$1 WHERE u.id=$2 ON CONFLICT DO NOTHING`,
    [context.organizationId, context.session.user.id]
  )
  return { ...context, storeId: store.organization_id, userId: context.session.user.id }
}
export async function customerAppointment(event: H3Event, id: string) {
  const userId = await claimPurchases(event)
  const [a] = await rows<Appointment>(
    `SELECT a.* FROM planning.appointment a JOIN products.orders o ON o.id=a.order_id WHERE a.id=$1 AND o.buyer_id=$2`,
    [id, userId]
  )
  if (!a) {
    throw createError({ statusCode: 404, message: 'Appointment not found' })
  }
  return { appointment: a, userId }
}
export async function verifiedCustomer(event: H3Event) {
  const session = await requireSession(event)
  if (!session.user.emailVerified) {
    throw createError({ statusCode: 403, message: 'Verify your email' })
  }
  return session
}

export async function appointmentScope(event: H3Event) {
  const session = await requireSession(event)
  let context
  try {
    context = await requireActiveOrganizationRole(event)
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode !== 403) {
      throw error
    }
  }
  const store = await getStore()
  if (context?.organizationType === 'PROVIDER' && context.organizationId === store.organization_id) {
    return {
      staff: true,
      canManage: ['owner', 'admin'].includes(context.role),
      storeId: store.organization_id,
      userId: session.user.id
    }
  }
  const userId = await claimPurchases(event)
  return { staff: false, canManage: true, storeId: store.organization_id, userId }
}
export async function appointmentAccess(event: H3Event, id: string, manage = false) {
  const scope = await appointmentScope(event)
  const [appointment] = await rows<Appointment>(
    `SELECT a.* FROM planning.appointment a JOIN products.orders o ON o.id=a.order_id WHERE a.id=$1 AND a.store_id=$2 AND ($3::boolean OR o.buyer_id=$4)`,
    [id, scope.storeId, scope.staff, scope.userId]
  )
  if (!appointment) {
    throw createError({ statusCode: 404, message: 'Appointment not found' })
  }
  if (manage && !scope.canManage) {
    throw createError({ statusCode: 403, message: 'Organization administrator access required' })
  }
  return { ...scope, appointment }
}
