import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { Client } from 'pg'
import { emptyProduct } from '../../products/shared/validation'
import { defaultPlanningPolicy } from '../../products/shared/planning'
import type { Appointment } from '../shared/types'

test(
  'planning database: reservations, payments, ownership, changes, refunds and effect retries',
  { skip: !process.env.PLANNING_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.PLANNING_TEST_DATABASE_URL!
    assert.match(new URL(url).pathname, /^\/portal_planning_test(?:_[a-z0-9]+)?$/)
    process.env.DATABASE_URL = url
    process.env.BETTER_AUTH_URL = 'http://localhost:3059'
    process.env.BETTER_AUTH_SECRET = 'planning-fixture-secret-with-at-least-thirty-two-characters'
    process.env.PLANNING_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64')
    process.env.RESEND_API_KEY = 're_local_fixture'
    process.env.RESEND_FROM_EMAIL = 'Portal <portal@example.test>'
    process.env.IS_DEVELOPMENT = 'false'
    const h3 = await import('h3')
    Object.assign(globalThis, {
      createError: h3.createError,
      useStorage: () => ({
        getItem: async () => readFile(new URL('../../core/server/utils/email-template.html', import.meta.url), 'utf8'),
        setItem: async () => {},
        removeItem: async () => {}
      }),
      useRuntimeConfig: () => ({
        public: { clients: { allowedTypes: ['person', 'organization'], personalSelfRegistration: false } },
        portalAuth: { registrationMode: 'invitation-only', githubEnabled: false, googleEnabled: false },
        portalDemo: { enabled: false },
        portalEmail: {}
      })
    })
    const db = new Client({ connectionString: url })
    await db.connect()
    let pool: { end(): Promise<void> } | undefined
    const originalFetch = globalThis.fetch,
      emails: Array<Record<string, unknown>> = []
    globalThis.fetch = async (input, init) => {
      const value = String(input)
      if (value.startsWith('https://api.resend.com/emails')) {
        emails.push(JSON.parse(String(init?.body)))
        return new Response(JSON.stringify({ id: 'email-' + emails.length }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      if (value.includes('www.googleapis.com/calendar/v3/calendars/')) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      throw new Error('Unexpected external request in planning test: ' + value)
    }
    try {
      for (const name of ['core', 'clients', 'products', 'planning']) {
        const directory = new URL(`../../${name}/migrations/`, import.meta.url)
        for (const file of (await readdir(directory)).filter((f) => f.endsWith('.sql')).sort()) {
          await db.query(await readFile(new URL(file, directory), 'utf8'))
        }
      }
      await db.query(
        `INSERT INTO public.organization(id,name,slug,created_at,organization_type) VALUES('store','Store','store',now(),'PROVIDER'),('client','Client','client',now(),'CLIENT')`
      )
      await db.query(
        `INSERT INTO public."user"(id,name,email,email_verified) VALUES('owner','Owner','owner@example.test',true),('provider','Provider','provider@example.test',true),('buyer','Buyer','buyer@example.test',true),('stranger','Stranger','stranger@example.test',true)`
      )
      await db.query(
        `INSERT INTO public.member(id,organization_id,user_id,role,created_at) VALUES('owner-member','store','owner','owner',now()),('provider-member','store','provider','member',now()),('buyer-member','client','buyer','owner',now()),('stranger-member','client','stranger','member',now())`
      )
      await db.query(`INSERT INTO products.store(organization_id,actor_id,enabled) VALUES('store','owner',true)`)
      const catalog = await import('../../products/server/utils/catalog')
      const booking = await import('../server/utils/booking')
      const management = await import('../server/utils/management')
      const jobs = await import('../server/utils/jobs')
      const orders = await import('../../products/server/utils/orders')
      const contracts = await import('../../products/server/utils/contracts')
      const { stripeProvider } = await import('../../products/server/utils/payments')
      const { registerPlanningAdapters } = await import('../server/utils/adapters')
      const { encrypt } = await import('../server/utils/crypto')
      pool = (await import('@nuxt-customer-portal/core/server/utils/db')).pool
      const day = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
      const product = {
        ...emptyProduct(),
        slug: 'appointment',
        type: 'service' as const,
        status: 'published' as const,
        content: {
          en: { title: 'Appointment', summary: '', description: '' },
          nl: { title: 'Afspraak', summary: '', description: '' }
        },
        planning: {
          enabled: true,
          durationMinutes: 60,
          providerUserIds: ['provider'],
          meetingProvider: 'zoom' as const,
          policyOverrides: {}
        }
      }
      await db.query('INSERT INTO products.product(id,store_id,slug,data) VALUES($1,$2,$3,$4)', [
        'product',
        'store',
        product.slug,
        product
      ])
      await db.query(
        `INSERT INTO products.price(id,product_id,currency,amount,tax_behavior) VALUES('price','product','EUR',1000,'inclusive')`
      )
      await db.query(
        `INSERT INTO planning.provider(store_id,user_id,enabled,timezone,grace_minutes,busy_calendar_ids,write_calendar_id) VALUES('store','provider',true,'UTC',15,ARRAY['calendar'],'calendar')`
      )
      for (const provider of ['google', 'zoom']) {
        await db.query(
          'INSERT INTO planning.connection(store_id,user_id,provider,credentials,external_user_id) VALUES($1,$2,$3,$4,$5)',
          [
            'store',
            'provider',
            provider,
            encrypt({ access_token: 'fixture', refresh_token: 'fixture', expiresAt: Date.now() + 86400000 }),
            'external-' + provider
          ]
        )
      }
      await db.query('INSERT INTO planning.availability(id,store_id,user_id,data) VALUES($1,$2,$3,$4)', [
        randomUUID(),
        'store',
        'provider',
        {
          id: 'window',
          userId: 'provider',
          timezone: 'UTC',
          date: day,
          endDate: null,
          startTime: '09:00',
          endTime: '20:00',
          recurring: false,
          productIds: null,
          exceptions: []
        }
      ])
      const policy = {
        ...defaultPlanningPolicy(),
        cancellationEnabled: true,
        changeFees: { EUR: 2500 },
        refundPercentage: 50
      }
      await db.query('INSERT INTO planning.settings(store_id,policy) VALUES($1,$2)', ['store', policy])
      const external: Array<{ start: string; end: string }> = []
      let calendarFailure = false,
        effectFailure = false
      const mirrors = new Map<string, unknown>(),
        meetings = new Map<string, { id: string; url: string }>()
      registerPlanningAdapters({
        calendar: {
          calendars: async () => [{ id: 'calendar', summary: 'Calendar', accessRole: 'owner' }],
          busy: async () => {
            if (calendarFailure) {
              throw new Error('Calendar unavailable')
            }
            return external
          },
          put: async (_s, _u, _c, event) => {
            if (effectFailure) {
              throw new Error('Fixture calendar failure')
            }
            mirrors.set(event.id, event)
            return undefined
          },
          remove: async (_s, _u, _c, id) => {
            mirrors.delete(id)
          },
          watch: async () => ({ resourceId: 'resource', expiration: String(Date.now() + 86400000) })
        },
        meeting: {
          ensure: async (_s, _u, id) => {
            if (!meetings.has(id)) {
              meetings.set(id, { id: String(meetings.size + 1), url: 'https://zoom.example.test/' + id })
            }
            return meetings.get(id)!
          },
          remove: async (_s, _u, id) => {
            for (const [key, m] of meetings) {
              if (m.id === id) {
                meetings.delete(key)
              }
            }
          }
        }
      })
      const receipts = new Map<string, Record<string, unknown>>(),
        completedAt = new Map<string, string>(),
        refunds = new Map<string, number>(),
        refundKeys = new Set<string>(),
        expired: string[] = []
      stripeProvider.checkout = async (order) => {
        const id = 'cs_' + order.id
        receipts.set(id, {
          id,
          metadata: { orderId: order.id },
          client_reference_id: order.id,
          currency: 'eur',
          payment_status: 'unpaid',
          status: 'open',
          amount_total: order.lines[0]!.unit_amount,
          total_details: { amount_tax: 0 },
          payment_intent: 'pi_' + order.id,
          line_items: {
            data: [
              {
                quantity: 1,
                price: { unit_amount: order.lines[0]!.unit_amount },
                amount_total: order.lines[0]!.unit_amount,
                taxes: []
              }
            ]
          }
        })
        return { id, url: 'https://stripe.example.test/' + id }
      }
      stripeProvider.lookupCheckout = async (id) => receipts.get(id) as never
      stripeProvider.lookupPayment = async (id) => ({ refunded: refunds.get(id) || 0, disputed: false })
      stripeProvider.paymentCompletedAt = async (id) => completedAt.get(id)!
      stripeProvider.expireCheckout = async (id) => {
        const receipt = receipts.get(id)!
        if (receipt.status === 'open') {
          receipt.status = 'expired'
          expired.push(id)
        }
      }
      stripeProvider.refund = async (id, amount, key) => {
        if (!refundKeys.has(key)) {
          refunds.set(id, (refunds.get(id) || 0) + amount)
          refundKeys.add(key)
        }
      }
      contracts.registerOrderIntegration({
        assertReady: async () => {},
        invoice: async () => 'fixture-invoice',
        refund: async () => {},
        notify: async () => {}
      })
      contracts.registerPlanningOrderIntegration({
        prepareCheckout: booking.prepareCheckout,
        bind: booking.bindPrepared,
        prepareOrder: booking.prepareOrder,
        confirm: booking.confirm
      })
      function event(cookie = '') {
        const req = new IncomingMessage(new Socket())
        req.headers = { cookie, origin: 'http://localhost:3059' }
        req.method = 'POST'
        req.url = '/'
        const res = new ServerResponse(req)
        return h3.createEvent(req, res)
      }
      let cookie = ''
      async function hold(hour: number, replacesId?: string, userCookie = cookie) {
        const e = event(userCookie)
        const result = await booking.reserve(e, {
          productId: 'product',
          providerUserId: 'provider',
          start: `${day}T${String(hour).padStart(2, '0')}:00:00Z`,
          customerTimezone: 'UTC',
          currency: 'EUR',
          locale: 'en',
          replacesId
        })
        const set = e.node.res.getHeader('set-cookie')
        if (set) {
          cookie = [cookie, ...(Array.isArray(set) ? set : [String(set)]).map((c) => c.split(';')[0])]
            .filter(Boolean)
            .join('; ')
        }
        return result
      }
      async function checkout(token: string, userCookie = cookie) {
        const result = await orders.createCheckout(event(userCookie), {
          productId: 'product',
          priceId: 'price',
          holdToken: token,
          locale: 'en',
          requestId: randomUUID(),
          billing: {
            type: 'person',
            firstName: 'Test',
            lastName: 'Buyer',
            name: 'Test Buyer',
            email: 'buyer@example.test',
            company: '',
            address: 'Street 1',
            country: 'NL',
            registrationNumber: '',
            vatNumber: ''
          }
        })
        const row = (await db.query('SELECT * FROM products.orders ORDER BY created_at DESC LIMIT 1')).rows[0]
        await db.query("UPDATE products.orders SET client_id='client',notified=true WHERE id=$1", [row.id])
        return { result, orderId: row.id, checkoutId: row.checkout_id as string }
      }
      async function pay(id: string, when = new Date().toISOString()) {
        const receipt = receipts.get(id)!
        receipt.payment_status = 'paid'
        receipt.status = 'complete'
        completedAt.set(String(receipt.payment_intent), when)
        await orders.reconcileCheckout(id, when)
      }
      async function appointment(orderId: string) {
        return (await db.query<Appointment>('SELECT * FROM planning.appointment WHERE order_id=$1', [orderId])).rows[0]!
      }
      async function signIn(userId: string, organizationId: string) {
        const { hashPassword } = await import('better-auth/crypto'),
          password = 'Fixture password 123!'
        await db.query(
          "INSERT INTO public.account(id,account_id,provider_id,user_id,password,updated_at) VALUES($1,$2,'credential',$2,$3,now())",
          ['account-' + userId, userId, await hashPassword(password)]
        )
        const { auth } = await import('@nuxt-customer-portal/core/server/utils/auth')
        const response = await auth.api.signInEmail({
          body: { email: userId + '@example.test', password },
          asResponse: true
        })
        assert.equal(response.status, 200)
        const cookies = response.headers
          .getSetCookie()
          .map((c) => c.split(';')[0])
          .join('; ')
        await db.query('UPDATE public.session SET active_organization_id=$2 WHERE user_id=$1', [userId, organizationId])
        return cookies
      }
      const buyerCookie = await signIn('buyer', 'client'),
        strangerCookie = await signIn('stranger', 'client'),
        providerCookie = await signIn('provider', 'store'),
        ownerCookie = await signIn('owner', 'store')
      await t.test('catalog routes to booking and rejects bypass without a reservation', async () => {
        const item = await catalog.publicProduct(await catalog.getProduct('store', 'product'), 'en')
        assert.equal(item.durationMinutes, 60)
        assert.equal(item.planningEnabled, true)
        assert.match(item.purchaseUrl, /\/book$/)
        await assert.rejects(
          orders.createCheckout(event(), {
            productId: 'product',
            priceId: 'price',
            locale: 'en',
            requestId: randomUUID(),
            billing: {
              type: 'person',
              firstName: 'Test',
              lastName: 'Buyer',
              name: 'Test Buyer',
              email: 'buyer@example.test',
              company: '',
              address: 'Street 1',
              country: 'NL',
              registrationNumber: '',
              vatNumber: ''
            }
          }),
          { statusCode: 409 }
        )
      })
      await t.test('concurrent holds across products have one winner and bind to a cookie', async () => {
        await db.query('INSERT INTO products.product(id,store_id,slug,data) VALUES($1,$2,$3,$4)', [
          'other-product',
          'store',
          'other-product',
          { ...product, slug: 'other-product' }
        ])
        await db.query(
          "INSERT INTO products.price(id,product_id,currency,amount,tax_behavior) VALUES('other-price','other-product','EUR',1000,'inclusive')"
        )
        const results = await Promise.allSettled([
          hold(9),
          booking.reserve(event(), {
            productId: 'other-product',
            providerUserId: 'provider',
            start: `${day}T09:00:00Z`,
            customerTimezone: 'UTC',
            currency: 'EUR'
          })
        ])
        assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
        await db.query("UPDATE planning.reservation SET status='expired' WHERE status='reserved'")
        const value = await hold(9)
        await assert.rejects(
          booking.prepareCheckout(event('planning-session=another'), {
            productId: 'product',
            priceId: 'price',
            locale: 'en',
            requestId: randomUUID(),
            billing: {} as never,
            holdToken: value.holdToken
          }),
          { statusCode: 409 }
        )
        await db.query("UPDATE planning.reservation SET status='expired' WHERE status='reserved'")
      })
      await db.query("UPDATE products.store SET mode='live'")
      const value = await hold(9),
        initial = await checkout(value.holdToken)
      await t.test('paid confirmation and duplicate payment reconciliation are idempotent', async () => {
        await pay(initial.checkoutId)
        await orders.reconcileCheckout(initial.checkoutId)
        assert.ok(await appointment(initial.orderId))
        assert.equal(
          (await db.query('SELECT count(*) FROM planning.appointment WHERE order_id=$1', [initial.orderId])).rows[0]
            .count,
          '1'
        )
      })
      const a = await appointment(initial.orderId)
      await t.test(
        'verified customers claim guests; other customers and provider members cannot administer',
        async () => {
          assert.equal((await management.appointmentDetails(event(buyerCookie), a.id)).id, a.id)
          await assert.rejects(management.appointmentDetails(event(strangerCookie), a.id), { statusCode: 404 })
          await assert.rejects(management.listProviders(event(providerCookie)), { statusCode: 403 })
          assert.equal((await management.listProviders(event(ownerCookie))).length, 2)
        }
      )
      await t.test('calendar failure closes availability and prevents new reservations', async () => {
        calendarFailure = true
        assert.deepEqual(await booking.available('product', { from: `${day}T00:00:00Z`, to: `${day}T23:59:59Z` }), [])
        await assert.rejects(hold(12))
        calendarFailure = false
      })
      await t.test('free reschedule keeps the original until checkout then swaps and counts once', async () => {
        const replacement = await hold(12, a.id, cookie + '; ' + buyerCookie)
        assert.equal(replacement.amount, 0)
        assert.equal(
          (await management.appointmentDetails(event(buyerCookie), a.id)).start.toISOString(),
          `${day}T09:00:00.000Z`
        )
        await checkout(replacement.holdToken, cookie + '; ' + buyerCookie)
        const changed = await appointment(initial.orderId)
        assert.equal(changed.start_at.toISOString(), `${day}T12:00:00.000Z`)
        assert.equal(changed.changes, 1)
        await orders.processOrder(initial.orderId)
        assert.equal((await appointment(initial.orderId)).changes, 1)
      })
      await t.test('abandoning a pending change preserves the original and releases the replacement', async () => {
        const replacement = await hold(15, a.id, cookie + '; ' + buyerCookie)
        const fee = await checkout(replacement.holdToken, cookie + '; ' + buyerCookie)
        assert.ok((await management.appointmentDetails(event(buyerCookie), a.id)).pendingChangeExpiresAt)
        await management.abandonChange(event(buyerCookie), a.id)
        const details = await management.appointmentDetails(event(buyerCookie), a.id)
        assert.equal(details.pendingChangeExpiresAt, null)
        assert.equal(details.changes, 1)
        assert.equal(details.start.toISOString(), `${day}T12:00:00.000Z`)
        assert.equal((await orders.getOrder(fee.orderId)).status, 'expired')
      })
      await t.test('paid reschedule uses a fee order and swaps only after payment', async () => {
        const replacement = await hold(14, a.id, cookie + '; ' + buyerCookie)
        assert.equal(replacement.amount, 2500)
        const fee = await checkout(replacement.holdToken, cookie + '; ' + buyerCookie)
        assert.equal((await appointment(initial.orderId)).start_at.toISOString(), `${day}T12:00:00.000Z`)
        assert.equal(
          (await db.query('SELECT unit_amount FROM products.order_line WHERE order_id=$1', [fee.orderId])).rows[0]
            .unit_amount,
          2500
        )
        await pay(fee.checkoutId)
        assert.equal((await appointment(initial.orderId)).changes, 2)
        await pay(fee.checkoutId)
        assert.equal((await appointment(initial.orderId)).changes, 2)
      })
      await t.test('failed external effects remain retryable without duplicate meetings or invites', async () => {
        effectFailure = true
        const result = await jobs.runJobs()
        assert.ok(result.failed)
        assert.ok((await appointment(initial.orderId)).effects_error)
        effectFailure = false
        await db.query('UPDATE planning.job SET available_at=now() WHERE completed_at IS NULL')
        await jobs.runJobs()
        assert.equal((await appointment(initial.orderId)).effects_error, null)
        assert.equal(meetings.size, 1)
        assert.equal(mirrors.size, 1)
        assert.ok(emails.some((email) => Array.isArray(email.attachments)))
      })
      await t.test('cancellation releases the slot and refunds policy amount exactly once', async () => {
        await management.cancel(event(buyerCookie), a.id)
        await management.cancel(event(buyerCookie), a.id)
        assert.equal((await appointment(initial.orderId)).status, 'cancelled')
        await jobs.runJobs()
        assert.equal(refunds.get('pi_' + initial.orderId), 500)
        await jobs.runJobs()
        assert.equal(refunds.get('pi_' + initial.orderId), 500)
        assert.equal(meetings.size, 0)
        assert.equal(mirrors.size, 0)
      })
      await t.test('expiry reconciles a delayed successful payment before releasing inventory', async () => {
        const reserved = await hold(9),
          check = await checkout(reserved.holdToken)
        const before = new Date(Date.now() - 60000).toISOString()
        await db.query('UPDATE planning.reservation SET expires_at=$2 WHERE order_id=$1', [
          check.orderId,
          new Date(Date.now() - 1000)
        ])
        const receipt = receipts.get(check.checkoutId)!
        receipt.payment_status = 'paid'
        receipt.status = 'complete'
        completedAt.set(String(receipt.payment_intent), before)
        await jobs.expireReservations()
        assert.ok(await appointment(check.orderId))
        assert.equal((await appointment(check.orderId)).status, 'confirmed')
      })
      await t.test('late payments refund rather than reclaiming an expired reservation', async () => {
        const reserved = await hold(17),
          check = await checkout(reserved.holdToken)
        await db.query("UPDATE planning.reservation SET expires_at=now()-interval '1 minute' WHERE order_id=$1", [
          check.orderId
        ])
        await jobs.expireReservations()
        assert.ok(expired.includes(check.checkoutId))
        await pay(check.checkoutId)
        await jobs.runJobs()
        assert.equal(await appointment(check.orderId), undefined)
        assert.equal(refunds.get('pi_' + check.orderId), 1000)
      })
      await t.test('free services require checkout and confirm without Stripe', async () => {
        await db.query("UPDATE products.store SET mode='sandbox'")
        await db.query("UPDATE products.product SET data=jsonb_set(data,'{isFree}','true') WHERE id='product'")
        await db.query("UPDATE products.price SET amount=0 WHERE id='price'")
        const reserved = await hold(19),
          check = await checkout(reserved.holdToken)
        const free = await appointment(check.orderId)
        assert.ok(free)
        assert.equal(free.snapshot.unitAmount, 0)
        assert.equal(
          (await db.query('SELECT checkout_id FROM products.orders WHERE id=$1', [check.orderId])).rows[0].checkout_id,
          null
        )
      })
    } finally {
      globalThis.fetch = originalFetch
      await db.end()
      await pool?.end()
    }
  }
)
