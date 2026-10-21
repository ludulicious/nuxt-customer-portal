import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import { Client } from 'pg'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { registerHooks } from 'node:module'
import { emptyProduct } from '../shared/validation'
import { purchaseLinks } from '../shared/links'

test(
  'product links persist privately, validate store languages and retain purchased snapshot destinations',
  { skip: !process.env.PRODUCTS_LINKS_TEST_DATABASE_URL },
  async () => {
    // Resolve the portal's H3 1 runtime, rather than an unrelated hoisted H3 2 installation.
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
    const url = process.env.PRODUCTS_LINKS_TEST_DATABASE_URL!
    assert.match(new URL(url).pathname, /^\/codex_products_test_/)
    process.env.DATABASE_URL = url
    process.env.BETTER_AUTH_URL = 'http://localhost:3059'
    process.env.BETTER_AUTH_SECRET = 'products-test-secret-with-at-least-thirty-two-characters'
    Object.assign(globalThis, h3, {
      useRuntimeConfig: () => ({ portalAuth: {}, portalDemo: { enabled: false }, portalEmail: {} })
    })
    const db = new Client({ connectionString: url })
    await db.connect()
    let pool: { end: () => Promise<void> } | undefined
    try {
      for (const name of ['core', 'products']) {
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
      const catalog = await import('../server/utils/catalog')
      const downloads = await import('../server/utils/downloads')
      pool = (await import('@nuxt-customer-portal/core/server/utils/db')).pool
      const link = {
        id: 'b84e1b42-704b-4aa8-bf2c-906ca3254877',
        url: 'https://docs.google.com/document/d/original/edit',
        labels: { en: 'Workbook', nl: 'Werkboek' }
      }
      const input = {
        ...emptyProduct(),
        slug: 'workbook',
        content: {
          en: { title: 'Workbook', summary: '', description: '' },
          nl: { title: 'Werkboek', summary: '', description: '' }
        },
        links: [link]
      }
      const product = await catalog.saveProduct('store', input)
      assert.deepEqual((await catalog.getProduct('store', product.id)).links, [link])
      const publicProduct = await catalog.publicProduct(product, 'en')
      assert.equal('links' in publicProduct, false)
      assert.equal(JSON.stringify(publicProduct).includes(link.url), false)
      await assert.rejects(
        catalog.saveProduct(
          'store',
          { ...input, links: [{ ...link, labels: { en: 'Workbook', nl: '' } }] },
          product.id
        ),
        (error: unknown) => (error as { data: { field: string } }).data.field === 'links.0.labels.nl'
      )
      await db.query(
        `INSERT INTO products.orders(id,store_id,request_id,request_hash,email,snapshot,status,total) VALUES('order','store','request','hash','buyer@example.test',$1,'paid',1000)`,
        [{ locale: 'nl' }]
      )
      await db.query(
        `INSERT INTO products.order_line(id,order_id,position,product_id,price_id,quantity,snapshot,unit_amount,total) VALUES('line','order',0,$1,$2,1,$3,1000,1000)`,
        [product.id, product.prices[0]!.id, { product, title: 'Workbook', price: { currency: 'EUR' } }]
      )
      const token = await downloads.orderDownloadToken('order')
      const handler = (await import('../server/api/store/purchases/[token].get')).default
      const request = () => {
        const req = new IncomingMessage(new Socket())
        req.url = `/api/store/purchases/${token}`
        req.method = 'GET'
        const event = h3.createEvent(req, new ServerResponse(req))
        event.context.params = { token }
        return event
      }
      const delivered = await handler(request())
      assert.deepEqual(delivered.links, [{ id: link.id, name: 'Werkboek', url: link.url }])
      assert.deepEqual(delivered.files, [])
      assert.deepEqual(Object.keys(delivered).sort(), ['files', 'links', 'status', 'variant'])
      await db.query(`UPDATE products.orders SET status='pending' WHERE id='order'`)
      assert.deepEqual((await handler(request())).links, [])
      await db.query(`UPDATE products.orders SET status='paid' WHERE id='order'`)
      const originalPrice = product.prices[0]!.id
      const updated = await catalog.saveProductLinks('store', product.id, [
        { ...link, url: 'https://youtu.be/new-resource' }
      ])
      assert.equal(updated.prices[0]!.id, originalPrice)
      await assert.rejects(
        catalog.saveProductLinks('store', product.id, [{ ...link, labels: { en: '', nl: 'Werkboek' } }]),
        { statusCode: 400 }
      )
      await assert.rejects(catalog.saveProductLinks('other', product.id, [link]), { statusCode: 403 })
      await assert.rejects(catalog.saveProductLinks('store', 'missing', [link]), { statusCode: 404 })
      await db.query(`UPDATE products.product SET data=jsonb_set(data,'{status}','"published"') WHERE id=$1`, [
        product.id
      ])
      await assert.rejects(catalog.saveProductLinks('store', product.id, []), { statusCode: 400 })
      await db.query(`UPDATE products.product SET data=jsonb_set(data,'{status}','"draft"') WHERE id=$1`, [product.id])
      await catalog.saveProduct(
        'store',
        { ...input, links: [{ ...link, url: 'https://youtu.be/replacement' }] },
        product.id
      )
      assert.deepEqual(purchaseLinks(await downloads.downloadOrder(token)), [
        { id: link.id, name: 'Werkboek', url: link.url }
      ])
      await catalog.saveProduct('store', { ...input, links: [] }, product.id)
      assert.equal(purchaseLinks(await downloads.downloadOrder(token))[0]?.url, link.url)
      await db.query(`UPDATE products.orders SET disputed=true WHERE id='order'`)
      assert.deepEqual(purchaseLinks(await downloads.downloadOrder(token)), [])
    } finally {
      await db.end()
      await pool?.end()
      hook.deregister()
    }
  }
)
