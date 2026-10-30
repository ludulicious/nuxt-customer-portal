import { sendPortalEmail } from '@nuxt-customer-portal/core/server/utils/portal-email'
import { emailRecipientName } from '@nuxt-customer-portal/core/shared/email-recipient'
import { storeOrderNotificationEmail } from '../../shared/emails'
import type { Order } from '../../shared/types'
import { baseUrl, type Store } from './access'
import { rows } from './database'
import { developmentSandboxEffectsEnabled } from './development'

export async function notifyStoreOwners(order: Order, store: Store) {
  if (
    order.notified ||
    !['paid', 'accepted'].includes(order.status) ||
    (order.snapshot.storeMode === 'sandbox' && !developmentSandboxEffectsEnabled())
  ) {
    return
  }
  const owners = await rows<{ id: string; email: string; first_name: string | null; name: string | null }>(
    `SELECT DISTINCT u.id,u.email,u.first_name,u.name
     FROM public.member m JOIN public."user" u ON u.id=m.user_id
     WHERE m.organization_id=$1 AND m.role='owner' ORDER BY u.id`,
    [order.store_id]
  )
  for (const owner of owners) {
    if (order.snapshot.ownerNotificationUserIds?.includes(owner.id)) {
      continue
    }
    await sendPortalEmail({
      moduleId: 'products',
      definition: storeOrderNotificationEmail,
      locale: store.default_locale,
      to: owner.email,
      values: {
        recipient_name: emailRecipientName({
          firstName: owner.first_name,
          displayName: owner.name,
          email: owner.email
        }),
        customer_name:
          order.snapshot.billing.name ||
          [order.snapshot.billing.firstName, order.snapshot.billing.lastName].filter(Boolean).join(' ') ||
          order.email,
        customer_email: order.email,
        product: order.lines.map((line) => line.snapshot.title).join(', '),
        bookingReference: order.booking_reference,
        url: `${baseUrl()}/admin/products/orders/${encodeURIComponent(order.id)}`
      },
      idempotencyKey: `store-order:${order.id}:${owner.id}`,
      subjectPrefix: order.snapshot.storeMode === 'sandbox' ? '[TEST] ' : undefined
    })
    await rows(
      `UPDATE products.orders SET snapshot=jsonb_set(snapshot,'{ownerNotificationUserIds}',
       COALESCE(snapshot->'ownerNotificationUserIds','[]'::jsonb) || jsonb_build_array($2::text)) WHERE id=$1`,
      [order.id, owner.id]
    )
    order.snapshot.ownerNotificationUserIds = [...(order.snapshot.ownerNotificationUserIds || []), owner.id]
  }
}
