import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { emailRecipientName } from '../../core/shared/email-recipient'
import { purchaseConfirmationEmail, storeOrderNotificationEmail } from '../shared/emails'
import type { Order } from '../shared/types'
import type { Store } from '../server/utils/access'

const require = createRequire(import.meta.url)
function source(file: string) {
  return ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
}
const notificationSource = source('../server/utils/order-notifications.ts')
const orderSource = source('../server/utils/orders.ts')

type SentEmail = {
  to: string
  definition: { id: string }
  locale: string
  values: Record<string, string>
  subjectPrefix?: string
}

function harness() {
  const emails: SentEmail[] = []
  const queries: Array<{ sql: string; params: unknown[] }> = []
  const owners = [
    { id: 'owner-one', email: 'one@example.test', first_name: 'Alex', name: 'Alex Owner' },
    { id: 'owner-two', email: 'two@example.test', first_name: 'Jamie', name: 'Jamie Owner' }
  ]
  const store = { organization_id: 'store', default_locale: 'nl' } as Store
  const order = {
    id: 'order-one',
    store_id: 'store',
    booking_reference: 'BK-123',
    status: 'paid',
    email: 'customer@example.test',
    snapshot: { locale: 'en', storeMode: 'live', billing: { name: 'Sam Customer', firstName: 'Sam' } },
    lines: [{ snapshot: { title: 'Consultation', product: { nextSteps: { en: '', nl: '' } } } }]
  } as Order
  let development = false
  let failRecipient = ''
  const database = {
    rows: async (sql: string, params: unknown[] = []) => {
      queries.push({ sql, params })
      if (sql.startsWith('SELECT DISTINCT u.id')) {
        return owners
      }
      if (sql.startsWith('SELECT * FROM products.orders')) {
        return [structuredClone(order)]
      }
      if (sql.startsWith('SELECT * FROM products.order_line')) {
        return order.lines
      }
      if (sql.includes("'{ownerNotificationUserIds}'")) {
        order.snapshot.ownerNotificationUserIds = [
          ...(order.snapshot.ownerNotificationUserIds || []),
          String(params[1])
        ]
      }
      if (sql.includes('SET notified=true')) {
        order.notified = true
      }
      return []
    }
  }
  const notifications = {} as typeof import('../server/utils/order-notifications')
  const orders = {} as typeof import('../server/utils/orders')
  function mockedRequire(id: string): unknown {
    if (id.endsWith('/portal-email')) {
      return {
        sendPortalEmail: async (email: SentEmail) => {
          if (email.to === failRecipient) {
            throw new Error('Email delivery failed')
          }
          emails.push(email)
        }
      }
    }
    if (id.endsWith('/email-recipient')) {
      return { emailRecipientName }
    }
    if (id.endsWith('/emails')) {
      return { storeOrderNotificationEmail, purchaseConfirmationEmail }
    }
    if (id.endsWith('/access')) {
      return { baseUrl: () => 'http://localhost:3059', getStore: async () => store }
    }
    if (id.endsWith('/database')) {
      return database
    }
    if (id.endsWith('/development')) {
      return { developmentSandboxEffectsEnabled: () => development }
    }
    if (id.endsWith('/order-notifications')) {
      return notifications
    }
    if (id.endsWith('/contracts')) {
      return { orderIntegration: () => ({ notify: async () => {} }) }
    }
    if (id.endsWith('/downloads')) {
      return {
        purchaseDownloads: async () => [],
        orderDownloadToken: async () => 'private-token',
        downloadLinksMarkdown: () => ''
      }
    }
    if (id.endsWith('/links')) {
      return { purchaseLinks: () => [] }
    }
    if (id.endsWith('/purchase-media')) {
      return { publicOrderPath: () => '/store/orders/private-token' }
    }
    if (id.startsWith('.') || id.startsWith('@nuxt-customer-portal/')) {
      return {}
    }
    return require(id)
  }
  runInNewContext(notificationSource, { exports: notifications, require: mockedRequire })
  runInNewContext(orderSource, { exports: orders, require: mockedRequire })
  return {
    emails,
    queries,
    order,
    store,
    owners,
    ...notifications,
    notifyOrder: () => orders.notifyOrder(order.id),
    enableDevelopment: () => {
      development = true
    },
    fail: (email: string) => {
      failRecipient = email
    }
  }
}

test('new orders notify store owners and the customer, but already-notified orders do not backfill owners', async () => {
  const fixture = harness()
  await fixture.notifyOrder()
  assert.deepEqual(
    fixture.emails.map((email) => email.to),
    ['one@example.test', 'two@example.test', 'customer@example.test']
  )
  const email = fixture.emails[0]!
  assert.equal(email.definition.id, 'store-order-new')
  assert.equal(email.locale, 'nl')
  assert.equal(email.values.customer_email, fixture.order.email)
  assert.equal(email.values.bookingReference, 'BK-123')
  assert.equal(email.values.url, 'http://localhost:3059/admin/products/orders/order-one')
  const recipients = fixture.queries.find(({ sql }) => sql.startsWith('SELECT DISTINCT u.id'))!
  assert.match(recipients.sql, /m.role='owner'/)
  assert.deepEqual(Array.from(recipients.params), ['store'])
  await fixture.notifyOrder()
  assert.equal(fixture.emails.length, 3)
  const historical = harness()
  historical.order.notified = true
  await historical.notifyOrder()
  assert.equal(historical.emails.length, 0)
})

test('appointment orders and invoice-accepted orders still notify owners without sending a purchase email', async () => {
  const fixture = harness()
  fixture.order.status = 'accepted'
  fixture.order.snapshot.paymentMethod = 'invoice'
  fixture.order.snapshot.planningReservationId = 'reservation'
  await fixture.notifyOrder()
  assert.equal(fixture.emails.length, 2)
  assert.equal(fixture.order.notified, true)
})

test('owner delivery failures remain retryable without resending successful owners', async () => {
  const fixture = harness()
  fixture.fail('two@example.test')
  await assert.rejects(fixture.notifyOrder(), /Email delivery failed/)
  assert.notEqual(fixture.order.notified, true)
  assert.deepEqual(fixture.order.snapshot.ownerNotificationUserIds, ['owner-one'])
  fixture.fail('')
  await fixture.notifyOrder()
  assert.equal(fixture.emails.filter((email) => email.to === 'one@example.test').length, 1)
  assert.equal(fixture.emails.length, 3)
})

test('sandbox notifications require explicit development effects and use test subjects', async () => {
  const fixture = harness()
  fixture.order.snapshot.storeMode = 'sandbox'
  await fixture.notifyStoreOwners(fixture.order, fixture.store)
  assert.equal(fixture.emails.length, 0)
  assert.equal(fixture.queries.length, 0)
  fixture.enableDevelopment()
  await fixture.notifyStoreOwners(fixture.order, fixture.store)
  assert.equal(fixture.emails.length, 2)
  assert.equal(fixture.emails[0]!.subjectPrefix, '[TEST] ')
})

test('unpaid or failed orders never trigger owner notifications', async () => {
  for (const status of ['pending', 'failed', 'expired'] as const) {
    const fixture = harness()
    fixture.order.status = status
    await fixture.notifyOrder()
    assert.equal(fixture.emails.length, 0)
  }
})

test('individual customer names fall back to billing first and last name', async () => {
  const fixture = harness()
  fixture.order.snapshot.billing.name = ''
  fixture.order.snapshot.billing.lastName = 'Customer'
  await fixture.notifyStoreOwners(fixture.order, fixture.store)
  assert.equal(fixture.emails[0]!.values.customer_name, 'Sam Customer')
})
