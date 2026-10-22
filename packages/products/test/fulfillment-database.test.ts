import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import { registerHooks } from 'node:module'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { emptyProduct } from '../shared/validation'

test(
  'fulfillment settings persist, snapshot at checkout and protect ineligible order lines',
  { skip: !process.env.PRODUCTS_FULFILLMENT_TEST_DATABASE_URL },
  async () => {
    const url = process.env.PRODUCTS_FULFILLMENT_TEST_DATABASE_URL!
    assert.match(new URL(url).pathname, /^\/codex_products_test_fulfillment_[a-z0-9]+$/)
    process.env.DATABASE_URL = url
    process.env.BETTER_AUTH_URL = 'http://localhost:3059'
    process.env.BETTER_AUTH_SECRET = 'fulfillment-test-secret-at-least-thirty-two-characters'
    process.env.IS_DEVELOPMENT = 'false'
    const hook = registerHooks({
      resolve(specifier, context, nextResolve) {
        return nextResolve(
          specifier,
          specifier === 'h3'
            ? { ...context, parentURL: new URL('../../core/package.json', import.meta.url).href }
            : context
        )
      }
    })
    const h3 = await import('h3')
    Object.assign(globalThis, h3, {
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
      for (const name of ['core', 'clients', 'products']) {
        const directory = new URL(`../../${name}/migrations/`, import.meta.url)
        for (const file of (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort()) {
          await db.query(await readFile(new URL(file, directory), 'utf8'))
        }
      }
      await db.query(
        `INSERT INTO public.organization(id,name,slug,created_at,organization_type) VALUES('store','Store','store',now(),'PROVIDER')`
      )
      await db.query(
        `INSERT INTO public."user"(id,name,email,email_verified) VALUES('owner','Owner','owner@example.test',true)`
      )
      await db.query(`INSERT INTO products.store(organization_id,actor_id,enabled) VALUES('store','owner',true)`)
      const { saveProduct, getProduct } = await import('../server/utils/catalog')
      const { createCheckout, getOrder, fulfillOrder } = await import('../server/utils/orders')
      pool = (await import('@nuxt-customer-portal/core/server/utils/db')).pool
      const input = {
        ...emptyProduct(),
        slug: 'manual-delivery',
        isFree: true,
        prices: [],
        content: {
          en: { title: 'Manual delivery', summary: '', description: '' },
          nl: { title: '', summary: '', description: '' }
        }
      }
      const product = await saveProduct('store', input)
      assert.equal((await getProduct('store', product.id)).requiresFulfillment, false)
      await db.query(`UPDATE products.product SET data=data-'requiresFulfillment' WHERE id=$1`, [product.id])
      assert.equal((await getProduct('store', product.id)).requiresFulfillment, false)
      await saveProduct('store', { ...product, requiresFulfillment: true }, product.id)
      const saved = await getProduct('store', product.id)
      assert.equal(saved.requiresFulfillment, true)
      await db.query(`UPDATE products.product SET data=jsonb_set(data,'{status}','"published"'::jsonb) WHERE id=$1`, [
        product.id
      ])
      const requestId = randomUUID()
      const req = new IncomingMessage(new Socket())
      req.method = 'POST'
      req.url = '/api/store/checkout'
      req.headers = { origin: 'http://localhost:3059' }
      await createCheckout(h3.createEvent(req, new ServerResponse(req)), {
        productId: product.id,
        priceId: saved.prices[0]!.id,
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
      const orderId = (await db.query('SELECT id FROM products.orders WHERE request_id=$1', [requestId])).rows[0]!
        .id as string
      const order = (await getOrder(orderId))!
      assert.equal(order.total, 0)
      assert.equal(order.lines[0]!.snapshot.product.requiresFulfillment, true)
      await saveProduct('store', { ...saved, requiresFulfillment: false }, product.id)
      assert.equal((await getOrder(orderId))!.lines[0]!.snapshot.product.requiresFulfillment, true)
      const source = order.lines[0]!
      for (const [id, flag] of [
        ['automatic', false],
        ['historical', undefined]
      ] as const) {
        const productSnapshot = { ...source.snapshot.product, requiresFulfillment: flag }
        await db.query(
          `INSERT INTO products.order_line(id,order_id,position,product_id,price_id,quantity,snapshot,unit_amount,total) VALUES($1,$2,$3,$4,$5,1,$6,0,0)`,
          [
            id,
            orderId,
            id === 'automatic' ? 1 : 2,
            product.id,
            source.price_id,
            { ...source.snapshot, product: productSnapshot }
          ]
        )
      }
      await assert.rejects(fulfillOrder('foreign-store', orderId), { statusCode: 404 })
      await db.query('UPDATE products.orders SET disputed=true WHERE id=$1', [orderId])
      await assert.rejects(fulfillOrder('store', orderId), { statusCode: 409 })
      await db.query('UPDATE products.orders SET disputed=false,total=1000,refunded=1000 WHERE id=$1', [orderId])
      await assert.rejects(fulfillOrder('store', orderId), { statusCode: 409 })
      await db.query('UPDATE products.orders SET total=0,refunded=0 WHERE id=$1', [orderId])
      const concurrent = await Promise.allSettled([fulfillOrder('store', orderId), fulfillOrder('store', orderId)])
      assert.equal(concurrent.filter((result) => result.status === 'fulfilled').length, 1)
      const rejected = concurrent.find((result) => result.status === 'rejected')
      assert.equal(rejected?.reason.statusCode, 409)
      const finished = (await getOrder(orderId))!
      assert.deepEqual(
        finished.lines.map((line) => line.fulfilled),
        [true, false, false]
      )
      await assert.rejects(fulfillOrder('store', orderId), { statusCode: 409 })
      for (const status of ['paid', 'accepted']) {
        await db.query('UPDATE products.orders SET status=$2,total=1000 WHERE id=$1', [orderId, status])
        await db.query('UPDATE products.order_line SET fulfilled=false,total=1000 WHERE id=$1', [source.id])
        await fulfillOrder('store', orderId)
        assert.equal((await getOrder(orderId))!.lines[0]!.fulfilled, true)
      }
      await db.query('UPDATE products.order_line SET fulfilled=false,refunded=1000 WHERE id=$1', [source.id])
      await assert.rejects(fulfillOrder('store', orderId), { statusCode: 409 })
    } finally {
      await pool?.end()
      await db.end()
      hook.deregister()
    }
  }
)
