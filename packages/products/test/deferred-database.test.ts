import assert from 'node:assert/strict'
import test from 'node:test'
import { readdir, readFile } from 'node:fs/promises'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { emptyProduct } from '../shared/validation'

test(
  'deferred checkout and unlisted product lifecycle',
  { skip: !process.env.PRODUCTS_DEFERRED_TEST_DATABASE_URL },
  async () => {
    const url = process.env.PRODUCTS_DEFERRED_TEST_DATABASE_URL!
    assert.match(new URL(url).pathname, /^\/codex_products_test_deferred(?:_[a-z0-9]+)?$/)
    process.env.DATABASE_URL = url
    process.env.BETTER_AUTH_URL = 'http://localhost:3059'
    process.env.BETTER_AUTH_SECRET = 'products-offers-test-secret-at-least-thirty-two-characters'
    process.env.IS_DEVELOPMENT = 'false'
    const h3 = await import('h3')
    Object.assign(globalThis, {
      createError: h3.createError,
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
    try {
      for (const name of ['core', 'clients', 'invoices', 'products', 'invoice-products']) {
        const directory = new URL(`../../${name}/migrations/`, import.meta.url)
        for (const file of (await readdir(directory)).filter((n) => n.endsWith('.sql')).sort()) {
          await db.query(await readFile(new URL(file, directory), 'utf8'))
        }
      }
      await db.query(
        `INSERT INTO public.organization(id,name,slug,created_at,organization_type) VALUES('store','Store','store',now(),'PROVIDER'),('other','Other','other',now(),'CLIENT')`
      )
      await db.query(
        `INSERT INTO public."user"(id,name,email,email_verified) VALUES('owner','Owner','owner@example.test',true)`
      )
      await db.query(
        `INSERT INTO public.member(id,organization_id,user_id,role,created_at) VALUES('owner-membership','store','owner','owner',now())`
      )
      await db.query(
        `INSERT INTO products.store(organization_id,actor_id,enabled,currencies) VALUES('store','owner',true,ARRAY['EUR','USD'])`
      )
      const catalog = await import('../server/utils/catalog')
      const { createCheckout, getOrder } = await import('../server/utils/orders')
      const { registerOrderIntegration } = await import('../server/utils/contracts')
      const { transaction } = await import('../server/utils/database')
      const { createCommerceDocument } = await import('../../invoices/server/utils/commerce')
      const { reviewDeferredInvoiceTax } = await import('../../invoices/server/utils/deferred-invoice')
      pool = (await import('@nuxt-customer-portal/core/server/utils/db')).pool
      let readyCalls = 0
      registerOrderIntegration({
        assertReady: async () => {
          readyCalls++
        },
        invoice: async (tx, order, actorId) =>
          createCommerceDocument(tx, {
            deferred: true,
            reference: `products:${order.id}`,
            storeId: 'store',
            clientId: order.client_id!,
            actorId,
            title: 'Purchase',
            currency: 'EUR',
            net: order.net!,
            tax: order.tax!,
            total: order.total!,
            taxDetails: null,
            recipientName: 'Buyer',
            address: 'Street 1',
            email: order.email,
            locale: 'en',
            paymentReference: '',
            lines: order.lines.map((line) => ({
              description: line.snapshot.title,
              quantity: line.quantity,
              net: line.net!,
              tax: line.tax!,
              taxDetails: null
            }))
          }),
        refund: async () => {
          throw new Error('Deferred orders must not refund through Stripe')
        },
        notify: async () => {
          throw new Error('Deferred orders must not send invoice email automatically')
        }
      })
      const input = {
        ...emptyProduct(),
        slug: 'public-service',
        type: 'service' as const,
        content: {
          en: { title: 'Service', summary: '', description: '' },
          nl: { title: '', summary: '', description: '' }
        },
        prices: [
          { currency: 'EUR', amount: 1210, taxBehavior: 'inclusive' as const },
          { currency: 'USD', amount: 1500, taxBehavior: 'inclusive' as const }
        ]
      }
      let product = await catalog.saveProduct('store', input)
      product = await catalog.saveProduct('store', { ...product, visibility: 'unlisted' }, product.id)
      assert.match(product.slug, /^[a-f0-9]{48}$/)
      await assert.rejects(catalog.getProduct('store', 'public-service', true), { statusCode: 404 })
      const slug = product.slug
      product = await catalog.saveProduct('store', { ...product, slug: 'try-custom-slug' }, product.id)
      assert.equal(product.slug, slug)
      const newUnlisted = await catalog.saveProduct('store', { ...input, slug: '', visibility: 'unlisted' })
      assert.notEqual(product.slug, newUnlisted.slug)
      await db.query(`UPDATE products.product SET data=jsonb_set(data,'{status}','"published"')`)
      assert.equal((await catalog.listProducts('store', {}, true)).items.length, 0)
      assert.equal((await catalog.listProducts('store', {}, false, true)).items.length, 0)
      assert.equal((await catalog.listProducts('store', {}, false)).items.length, 2)
      assert.equal((await catalog.getProduct('store', slug, true)).visibility, 'unlisted')
      await db.query(`UPDATE products.store SET online_payment=false,invoice_payment=true`)
      function event() {
        const req = new IncomingMessage(new Socket())
        req.headers = { origin: 'http://localhost:3059' }
        req.method = 'POST'
        req.url = '/'
        return h3.createEvent(req, new ServerResponse(req))
      }
      const purchase = {
        productId: product.id,
        priceId: product.prices.find((price) => price.currency === 'EUR')!.id,
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
      }
      await assert.rejects(createCheckout(event(), { ...purchase, paymentMethod: 'online' }), { statusCode: 409 })
      await db.query(`UPDATE products.price SET tax_behavior='exclusive' WHERE id=$1`, [purchase.priceId])
      await assert.rejects(createCheckout(event(), purchase), { statusCode: 409 })
      await db.query(`UPDATE products.price SET tax_behavior='inclusive' WHERE id=$1`, [purchase.priceId])
      const response = await createCheckout(event(), purchase)
      const {
        rows: [saved]
      } = await db.query('SELECT * FROM products.orders WHERE request_id=$1', [purchase.requestId])
      assert.equal(saved.status, 'accepted')
      assert.equal(saved.total, 1210)
      assert.equal(saved.payment_id, null)
      assert.equal(saved.snapshot.paymentMethod, 'invoice')
      assert.ok(saved.snapshot.acceptedAt)
      assert.equal(saved.snapshot.paymentCompletedAt, undefined)
      assert.equal((await createCheckout(event(), purchase)).url, response.url)
      // Sandbox suppresses external effects. Exercise invoice generation with its real transactional helper.
      const invoiceId = await transaction((tx) =>
        createCommerceDocument(tx, {
          deferred: true,
          reference: `products:${saved.id}`,
          storeId: 'store',
          clientId: 'other',
          actorId: 'owner',
          title: 'Purchase',
          currency: 'EUR',
          net: 1210,
          tax: 0,
          total: 1210,
          taxDetails: null,
          recipientName: 'Buyer',
          address: 'Street 1',
          email: 'buyer@example.test',
          locale: 'en',
          paymentReference: '',
          lines: [{ description: 'Service', quantity: 1, net: 1210, tax: 0, taxDetails: null }]
        })
      )
      const {
        rows: [invoice]
      } = await db.query('SELECT * FROM invoices.invoice WHERE id=$1', [invoiceId])
      assert.equal(invoice.status, 'DRAFT')
      assert.equal(invoice.tax_review_required, true)
      assert.equal(invoice.agreed_total_minor, 1210)
      assert.equal(invoice.issued_at, null)
      assert.equal(
        (await db.query('SELECT * FROM invoices.invoice_payment WHERE invoice_id=$1', [invoiceId])).rowCount,
        0
      )
      const { rows: lines } = await db.query('SELECT * FROM invoices.invoice_line WHERE invoice_id=$1', [invoiceId])
      await assert.rejects(reviewDeferredInvoiceTax('store', 'owner', invoiceId, []), { statusCode: 400 })
      await reviewDeferredInvoiceTax('store', 'owner', invoiceId, [{ lineId: lines[0].id, vatRateBasisPoints: 2100 }])
      const {
        rows: [line]
      } = await db.query('SELECT * FROM invoices.invoice_line WHERE invoice_id=$1', [invoiceId])
      assert.equal(line.unit_price_minor, 1000)
      assert.equal(line.exact_tax_minor, 210)
      await reviewDeferredInvoiceTax('store', 'owner', invoiceId, [{ lineId: line.id, vatRateBasisPoints: 2100 }])
      assert.equal(
        (await db.query('SELECT unit_price_minor FROM invoices.invoice_line WHERE id=$1', [line.id])).rows[0]
          .unit_price_minor,
        1000
      )
      await db.query('UPDATE products.orders SET invoice_id=$2 WHERE id=$1', [saved.id, invoiceId])
      Object.assign(globalThis, { defineNitroPlugin: (plugin: () => unknown) => plugin })
      const integration = await import('../../invoice-products/server/plugins/purchases')
      integration.default({} as never)
      const { orderIntegration } = await import('../server/utils/contracts')
      await db.query('UPDATE products.orders SET client_id=$2 WHERE id=$1', [saved.id, 'other'])
      const repeated = await transaction(async (tx) =>
        orderIntegration().invoice(tx, (await getOrder(saved.id, tx))!, 'owner')
      )
      assert.equal(repeated, invoiceId)
      assert.equal(
        (await db.query('SELECT * FROM invoices.invoice WHERE external_reference=$1', [`products:${saved.id}`]))
          .rowCount,
        1
      )
      assert.equal(
        (await db.query('SELECT * FROM invoice_products.email_job WHERE order_id=$1', [saved.id])).rowCount,
        0
      )
      assert.equal((await getOrder(saved.id))?.paymentStatus, 'unpaid')
      await db.query(
        `INSERT INTO invoices.invoice_payment(id,invoice_id,paid_on,amount_minor,created_by_id) VALUES('partial',$1,CURRENT_DATE,500,'owner')`,
        [invoiceId]
      )
      assert.equal((await getOrder(saved.id))?.paymentStatus, 'partial')
      assert.equal((await getOrder(saved.id))?.outstandingAmount, 710)
      await db.query(
        `INSERT INTO invoices.invoice_payment(id,invoice_id,paid_on,amount_minor,created_by_id) VALUES('remainder',$1,CURRENT_DATE,710,'owner')`,
        [invoiceId]
      )
      assert.equal((await getOrder(saved.id))?.paymentStatus, 'paid')
      assert.equal((await getOrder(saved.id))?.outstandingAmount, 0)
      assert.equal((await getOrder(saved.id))?.status, 'accepted')
      assert.equal(readyCalls, 0)
    } finally {
      await pool?.end()
      await db.end()
    }
  }
)
