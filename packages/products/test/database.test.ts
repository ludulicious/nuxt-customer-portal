import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import { Client } from 'pg'
import { emptyProduct } from '../shared/validation'

test(
  'store migrations, isolation, price history, invoices, and guest clients',
  { skip: !process.env.PRODUCTS_TEST_DATABASE_URL },
  async () => {
    const url = process.env.PRODUCTS_TEST_DATABASE_URL!
    assert.match(new URL(url).pathname, /^\/codex_products_test_/)
    process.env.DATABASE_URL = url
    process.env.BETTER_AUTH_URL = 'http://localhost:3059'
    process.env.BETTER_AUTH_SECRET = 'products-test-secret-with-at-least-thirty-two-characters'
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
    let pool: { end: () => Promise<void> } | undefined
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
        `INSERT INTO public."user"(id,name,email,email_verified) VALUES('owner','Owner','owner@example.test',true),('buyer','Buyer','buyer@example.test',true)`
      )
      await db.query(`INSERT INTO products.store(organization_id,actor_id,enabled) VALUES('store','owner',true)`)
      const catalog = await import('../server/utils/catalog')
      pool = (await import('@nuxt-customer-portal/core/server/utils/db')).pool
      const source = {
        ...emptyProduct(),
        slug: 'coaching',
        type: 'service',
        status: 'published',
        content: {
          en: {
            title: 'Coaching',
            summary: '',
            description: '**Welcome** <script>alert(1)</script> [bad](javascript:alert(1))'
          },
          nl: { title: 'Coaching NL', summary: '', description: '' }
        }
      }
      const product = await catalog.saveProduct('store', source)
      await assert.rejects(catalog.getProduct('other', product.id), { statusCode: 404 })
      const page = await catalog.listProducts('store', { search: 'coach' }, true)
      assert.equal(page.items.length, 1)
      const publicProduct = await catalog.publicProduct(product, 'en')
      assert.doesNotMatch(publicProduct.descriptionHtml, /<script|javascript:/)
      assert.match(publicProduct.descriptionHtml, /<strong>Welcome<\/strong>/)
      assert.equal('fileIds' in publicProduct, false)
      const old = product.prices[0]!
      const changed = await catalog.saveProduct(
        'store',
        { ...source, prices: [{ currency: 'EUR', amount: 1500, taxBehavior: 'exclusive' }] },
        product.id
      )
      assert.notEqual(changed.prices[0]!.id, old.id)
      assert.equal((await db.query('SELECT active FROM products.price WHERE id=$1', [old.id])).rows[0].active, false)
      await assert.rejects(catalog.saveProduct('store', source), { statusCode: 409 })
      const { provisionPurchaseClient } = await import('@nuxt-customer-portal/clients/server/utils/purchase-client')
      await db.query('BEGIN')
      const billing = {
        type: 'person' as const,
        name: 'Buyer',
        email: 'buyer@example.test',
        company: '',
        address: 'Street 1',
        registrationNumber: '',
        vatNumber: ''
      }
      const client = await provisionPurchaseClient(db as never, billing, null, 'owner', 'en')
      await db.query('COMMIT')
      assert.ok(client.invitationId)
      assert.equal(
        (await db.query('SELECT count(*) FROM public.member WHERE organization_id=$1', [client.clientId])).rows[0]
          .count,
        '0'
      )
      await db.query('BEGIN')
      const again = await provisionPurchaseClient(db as never, billing, null, 'owner', 'en')
      await db.query('COMMIT')
      assert.equal(again.clientId, client.clientId)
      await assert.rejects(
        provisionPurchaseClient(db as never, { ...billing, clientId: 'store' }, 'buyer', 'owner', 'en'),
        { statusCode: 403 }
      )
      await db.query(
        `INSERT INTO invoices.settings(organization_id,enabled,address,registration_number,vat_number,invoice_email) VALUES('store',true,'Store address','123','NL123','billing@example.test')`
      )
      const { createCommerceDocument } = await import('@nuxt-customer-portal/invoices/server/utils/commerce')
      const input = {
        reference: 'test-order',
        storeId: 'store',
        clientId: client.clientId,
        actorId: 'owner',
        title: 'Coaching',
        currency: 'KWD',
        net: 1001,
        tax: 210,
        total: 1211,
        taxDetails: { taxes: [] },
        recipientName: 'Buyer',
        address: 'Street 1',
        email: billing.email,
        locale: 'en' as const,
        paymentReference: 'pi_test'
      }
      await db.query('BEGIN')
      const invoice = await createCommerceDocument(db as never, input)
      await db.query('COMMIT')
      assert.equal(await createCommerceDocument(db as never, input), invoice)
      const { getInvoice } = await import('@nuxt-customer-portal/invoices/server/utils/invoice-repository')
      const document = await getInvoice('store', invoice)
      assert.equal(document.totalMinor, 1211)
      assert.equal(document.vatMinor, 210)
      assert.equal(document.paidMinor, 1211)
      await db.query('BEGIN')
      const credit = await createCommerceDocument(db as never, {
        ...input,
        reference: 'refund',
        originalInvoiceId: invoice,
        net: -1001,
        tax: -210,
        total: -1211
      })
      await db.query('COMMIT')
      const creditDocument = await getInvoice('store', credit)
      assert.equal(creditDocument.totalMinor, -1211)
      assert.equal(creditDocument.documentType, 'credit')
      const snapshot = { product: source, title: 'Coaching', price: old, billing, locale: 'en' }
      await db.query(
        `INSERT INTO products.purchase(id,store_id,product_id,price_id,request_id,request_hash,email,snapshot) VALUES('order','store',$1,$2,'request','hash','buyer@example.test',$3)`,
        [product.id, old.id, snapshot]
      )

      const { catalogAccess, newKey, hash, rateLimit } = await import('../server/utils/access')
      const key = newKey()
      await db.query('INSERT INTO products.api_key(id,store_id,name,hash,prefix) VALUES($1,$2,$3,$4,$5)', [
        'key',
        'store',
        'Test',
        hash(key),
        key.slice(0, 12)
      ])
      const event = {
        context: {},
        node: { req: { headers: { authorization: `Bearer ${key}` }, socket: { remoteAddress: 'localhost' } } }
      } as never
      assert.equal((await catalogAccess(event)).organization_id, 'store')
      await db.query("UPDATE products.api_key SET revoked_at=now() WHERE id='key'")
      await assert.rejects(catalogAccess(event), { statusCode: 401 })
      await rateLimit('limited', 1)
      await assert.rejects(rateLimit('limited', 1), { statusCode: 429 })
      process.env.PRODUCTS_STRIPE_SECRET_KEY = 'sk_test_local_fixture'
      process.env.PRODUCTS_STRIPE_WEBHOOK_SECRET = 'whsec_local_fixture'
      const { stripeProvider, stripeClient } = await import('../server/utils/payments')
      Object.assign(globalThis, { defineNitroPlugin: (callback: () => void) => callback() })
      await import('../../invoice-products/server/plugins/purchases')
      await db.query("UPDATE products.purchase SET client_id=$1,notified=true WHERE id='order'", [client.clientId])
      const originalPayment = stripeProvider.lookupPayment
      stripeProvider.lookupPayment = async () => ({ refunded: 0, disputed: false })
      const original = stripeProvider.lookupCheckout
      stripeProvider.lookupCheckout = async () =>
        ({
          id: 'cs_test',
          metadata: { orderId: 'order' },
          client_reference_id: 'order',
          currency: 'eur',
          payment_status: 'paid',
          amount_total: 1000,
          total_details: { amount_tax: 174 },
          payment_intent: 'pi_fixture',
          line_items: { data: [{ quantity: 1, price: { unit_amount: 1000 }, taxes: [] }] }
        }) as never
      const { handleWebhook } = await import('../server/utils/webhooks')
      const notification = {
        id: 'evt_fixture',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test' } }
      } as never
      try {
        await handleWebhook(notification)
        await handleWebhook(notification)
        const createdInvoice = (await db.query("SELECT invoice_id FROM products.purchase WHERE id='order'")).rows[0]
          .invoice_id
        assert.ok(createdInvoice)
        assert.equal((await getInvoice('store', createdInvoice)).totalMinor, 1000)
        stripeProvider.lookupPayment = async () => ({ refunded: 1000, disputed: false })
        const refundEvent = {
          id: 'evt_refund',
          type: 'charge.refunded',
          data: { object: { payment_intent: 'pi_fixture' } }
        } as never
        await handleWebhook(refundEvent)
        await handleWebhook(refundEvent)
        assert.equal(
          (await db.query("SELECT count(*) FROM invoice_products.refund_credit WHERE order_id='order'")).rows[0].count,
          '1'
        )
        assert.equal((await db.query("SELECT refunded FROM products.purchase WHERE id='order'")).rows[0].refunded, 1000)
      } finally {
        stripeProvider.lookupCheckout = original
        stripeProvider.lookupPayment = originalPayment
      }
      assert.equal((await db.query("SELECT status FROM products.purchase WHERE id='order'")).rows[0].status, 'paid')
      assert.equal(
        (await db.query("SELECT count(*) FROM products.webhook WHERE id='evt_fixture' AND processed_at IS NOT NULL"))
          .rows[0].count,
        '1'
      )
      const payload = JSON.stringify({
        id: 'evt_signed',
        object: 'event',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test' } }
      })
      const signature = stripeClient().webhooks.generateTestHeaderString({ payload, secret: 'whsec_local_fixture' })
      assert.equal(stripeProvider.verify(payload, signature).id, 'evt_signed')
      assert.throws(() => stripeProvider.verify(payload + ' ', signature))
      assert.equal((await catalog.deletion('store', product.id)).eligible, false)
      await assert.rejects(catalog.deleteProduct('store', product.id, 'Coaching'), { statusCode: 409 })
      await catalog.saveProduct('store', { ...source, status: 'archived' }, product.id)
      assert.equal((await catalog.listProducts('store', {}, true)).items.length, 0)
      const removable = await catalog.saveProduct('store', { ...source, slug: 'unused', status: 'draft' })
      await catalog.deleteProduct('store', removable.id, 'Coaching')
      await assert.rejects(catalog.getProduct('store', removable.id), { statusCode: 404 })
      const categories = await import('../server/utils/categories')
      const category = await categories.saveCategory('store', { name: 'Coaching' })
      await assert.rejects(categories.saveCategory('store', { name: ' coaching ' }), { statusCode: 409 })
      assert.deepEqual(await categories.listCategories('other'), [])
      await assert.rejects(categories.saveCategory('other', { name: 'Foreign' }, category.id), { statusCode: 404 })
      await assert.rejects(catalog.saveProduct('store', { ...source, slug: 'invalid-category', category: 'Missing' }), {
        statusCode: 409
      })
      const categorized = await catalog.saveProduct('store', {
        ...source,
        slug: 'categorized',
        status: 'draft',
        category: 'Coaching'
      })
      await categories.saveCategory('store', { name: 'Sessions' }, category.id)
      assert.equal((await catalog.getProduct('store', categorized.id)).category, 'Sessions')
      assert.equal((await categories.listCategories('store'))[0]?.productCount, 1)
      await assert.rejects(categories.deleteCategory('store', category.id, { name: 'Sessions' }), { statusCode: 409 })
      await catalog.deleteProduct('store', categorized.id, 'Coaching')
      await assert.rejects(categories.deleteCategory('store', category.id, { name: 'Wrong' }), { statusCode: 400 })
      await categories.deleteCategory('store', category.id, { name: 'Sessions' })
      assert.deepEqual(await categories.listCategories('store'), [])
    } finally {
      await db.end()
      await pool?.end()
    }
  }
)
