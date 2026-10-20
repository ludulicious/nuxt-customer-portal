import assert from 'node:assert/strict'
import test from 'node:test'
import { readdir, readFile } from 'node:fs/promises'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { emptyProduct } from '../shared/validation'

test(
  'scheduled offer storage, catalog, concurrency and checkout',
  { skip: !process.env.PRODUCTS_OFFERS_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.PRODUCTS_OFFERS_TEST_DATABASE_URL!
    assert.match(new URL(url).pathname, /^\/codex_products_test_offers(?:_[a-z0-9]+)?$/)
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
      const offers = await import('../server/utils/offers')
      const { createCheckout } = await import('../server/utils/orders')
      const { transaction } = await import('../server/utils/database')
      pool = (await import('@nuxt-customer-portal/core/server/utils/db')).pool
      const product = await catalog.saveProduct('store', {
        ...emptyProduct(),
        slug: 'offers-product',
        type: 'service',
        status: 'draft',
        content: {
          en: { title: 'Offers', summary: '', description: '' },
          nl: { title: '', summary: '', description: '' }
        },
        prices: [
          { currency: 'EUR', amount: 1000, taxBehavior: 'inclusive' },
          { currency: 'USD', amount: 1200, taxBehavior: 'inclusive' }
        ]
      })
      await db.query(
        "UPDATE products.product SET data=jsonb_set(data,'{status}', '\"published\"'::jsonb) WHERE id=$1",
        [product.id]
      )
      const start = new Date(Date.now() - 60000).toISOString(),
        end = new Date(Date.now() + 3600000).toISOString()
      const input = {
        startsAt: start,
        endsAt: end,
        isFree: false,
        prices: [
          { currency: 'EUR', amount: 500, taxBehavior: 'inclusive' },
          { currency: 'USD', amount: 600, taxBehavior: 'inclusive' }
        ]
      }
      function event() {
        const req = new IncomingMessage(new Socket())
        req.headers = { origin: 'http://localhost:3059' }
        req.method = 'POST'
        req.url = '/'
        return h3.createEvent(req, new ServerResponse(req))
      }
      const purchase = (priceId: string, requestId = randomUUID()) => ({
        productId: product.id,
        priceId,
        locale: 'en',
        requestId,
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
      await t.test('validates ownership, currencies, reductions and concurrent overlap', async () => {
        await assert.rejects(offers.saveOffer('other', product.id, input), { statusCode: 404 })
        await assert.rejects(offers.saveOffer('store', 'missing', input), { statusCode: 404 })
        await assert.rejects(offers.saveOffer('store', product.id, { ...input, prices: input.prices.slice(0, 1) }), {
          statusCode: 400
        })
        await assert.rejects(
          offers.saveOffer('store', product.id, {
            ...input,
            prices: input.prices.map((p) => ({ ...p, amount: 2000 }))
          }),
          { statusCode: 400 }
        )
        const results = await Promise.allSettled([
          offers.saveOffer('store', product.id, input),
          offers.saveOffer('store', product.id, input)
        ])
        assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
        assert.equal(results.filter((r) => r.status === 'rejected').length, 1)
      })
      let offer = (await offers.productOffers(product.id))[0]!
      await t.test('catalog list/detail retain original values and filter currencies', async () => {
        const detail = await catalog.getProduct('store', product.id)
        assert.equal(detail.prices[0]!.amount, 1000)
        const at = new Date(start)
        const direct = await catalog.publicProduct(detail, 'en', 'EUR', at)
        const page = await catalog.listProducts('store', {}, true)
        const listed = await catalog.publicProduct(page.items[0]!, 'en', 'EUR', at)
        assert.deepEqual(listed.prices, direct.prices)
        assert.deepEqual(
          direct.prices.map((p) => [p.amount, p.originalAmount, p.offer?.id]),
          [[500, 1000, offer.id]]
        )
        assert.equal(direct.pricingComplete, true)
        const ended = await catalog.publicProduct(detail, 'en', 'EUR', new Date(end))
        assert.equal(ended.prices[0]!.amount, 1000)
        assert.equal(ended.prices[0]!.offer, null)
      })
      await t.test('regular and store currency changes cannot invalidate outstanding offers', async () => {
        await assert.rejects(catalog.saveProductPricing('store', product.id, { isFree: false, prices: input.prices }), {
          statusCode: 409
        })
        await assert.rejects(catalog.saveProductPricing('store', product.id, { isFree: true, prices: [] }), {
          statusCode: 409
        })
        await assert.rejects(
          transaction((tx) => offers.validateOutstandingOffers(product.id, product, ['EUR', 'USD', 'GBP'], tx)),
          { statusCode: 409 }
        )
      })
      await t.test('checkout rejects regular or edited quotes and keeps created-order snapshots', async () => {
        await assert.rejects(createCheckout(event(), purchase(product.prices[0]!.id)), { statusCode: 409 })
        const quote = offer.prices[0]!
        const body = purchase(quote.id)
        const first = await createCheckout(event(), body)
        assert.match(first.url, /sandbox-checkout/)
        offer = await offers.saveOffer(
          'store',
          product.id,
          { ...input, prices: input.prices.map((p) => ({ ...p, amount: 400 })) },
          offer.id
        )
        await assert.rejects(createCheckout(event(), purchase(quote.id)), { statusCode: 409 })
        assert.equal((await createCheckout(event(), body)).url, first.url)
        const line = (
          await db.query('SELECT snapshot,unit_amount FROM products.order_line WHERE price_id=$1', [quote.id])
        ).rows[0]!
        assert.equal(line.unit_amount, 500)
        assert.equal(line.snapshot.price.originalAmount, 1000)
        assert.equal(
          (await db.query('SELECT active FROM products.price WHERE id=$1', [quote.id])).rows[0]!.active,
          false
        )
      })
      await t.test('free offers work in all currencies and finalize without payment', async () => {
        offer = await offers.saveOffer('store', product.id, { ...input, isFree: true, prices: [] }, offer.id)
        const free = await catalog.publicProduct(await catalog.getProduct('store', product.id), 'en', 'USD')
        assert.equal(free.isFree, true)
        assert.equal(free.prices.length, 1)
        assert.equal(free.prices[0]!.originalAmount, 1200)
        const body = purchase(free.prices[0]!.id)
        const result = await createCheckout(event(), body)
        assert.doesNotMatch(result.url, /sandbox-checkout/)
        const order = (
          await db.query('SELECT id,status,total FROM products.orders WHERE request_id=$1', [body.requestId])
        ).rows[0]!
        assert.equal(order.status, 'paid')
        assert.equal(order.total, 0)
        await assert.rejects(offers.cancelOffer('other', product.id, offer.id), { statusCode: 404 })
        await offers.cancelOffer('store', product.id, offer.id)
        await assert.rejects(createCheckout(event(), purchase(free.prices[0]!.id)), { statusCode: 409 })
        assert.equal((await createCheckout(event(), body)).url, result.url)
        const restored = await catalog.publicProduct(await catalog.getProduct('store', product.id), 'en', 'USD')
        assert.equal(restored.isFree, false)
        assert.equal(restored.prices[0]!.amount, 1200)
        assert.equal((await offers.productOffers(product.id))[0]!.enabled, false)
        assert.equal(
          (await db.query('SELECT price_id FROM products.order_line WHERE order_id=$1', [order.id])).rows[0]!.price_id,
          free.prices[0]!.id
        )
      })
      await t.test('adjacent offers are accepted and cancelled offers do not block new periods', async () => {
        const next = await offers.saveOffer('store', product.id, input)
        const adjacent = await offers.saveOffer('store', product.id, {
          ...input,
          startsAt: end,
          endsAt: new Date(Date.parse(end) + 3600000).toISOString()
        })
        assert.ok(adjacent.id)
        await offers.cancelOffer('store', product.id, next.id)
        await offers.cancelOffer('store', product.id, adjacent.id)
      })
    } finally {
      await db.end()
      await pool?.end()
    }
  }
)
