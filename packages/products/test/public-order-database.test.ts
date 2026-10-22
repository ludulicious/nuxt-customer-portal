import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import { createServer } from 'node:http'
import { registerHooks } from 'node:module'
import { Client } from 'pg'
import { emptyProduct } from '../shared/validation'
import type { PublicOrderDetails } from '../shared/public-order'

test(
  'anonymous order details and media delivery preserve snapshot access and stream byte ranges',
  { skip: !process.env.PRODUCTS_PUBLIC_ORDER_TEST_DATABASE_URL },
  async () => {
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
    const url = process.env.PRODUCTS_PUBLIC_ORDER_TEST_DATABASE_URL!
    assert.match(new URL(url).pathname, /^\/codex_products_test_/)
    process.env.DATABASE_URL = url
    process.env.BETTER_AUTH_SECRET = 'public-order-test-secret-with-at-least-thirty-two-characters'
    process.env.PRODUCTS_STORAGE_PROVIDER = 'bunny'
    process.env.PRODUCTS_IMAGEKIT_URL_ENDPOINT = 'https://images.example.test'
    process.env.PRODUCTS_BUNNY_STORAGE_ZONE = 'test-zone'
    process.env.PRODUCTS_BUNNY_STORAGE_PASSWORD = 'test-key'
    const upstreamRequests: Array<string | undefined> = []
    const upstream = createServer((req, res) => {
      upstreamRequests.push(req.headers.range)
      assert.equal(req.headers.accesskey, 'test-key')
      if (req.headers.range === 'bytes=100-') {
        res.writeHead(416, { 'Content-Range': 'bytes */10' })
        res.end()
        return
      }
      if (req.headers.range === 'bytes=6-9') {
        res.writeHead(206, { 'Content-Type': 'audio/mpeg', 'Content-Range': 'bytes 6-9/10', 'Accept-Ranges': 'bytes' })
        res.end('6789')
        return
      }
      if (req.headers.range) {
        res.writeHead(206, {
          'Content-Type': 'audio/mpeg',
          'Content-Length': '4',
          'Content-Range': 'bytes 2-5/10',
          'Accept-Ranges': 'bytes'
        })
        res.end('2345')
        return
      }
      res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': '10', 'Accept-Ranges': 'bytes' })
      res.end('0123456789')
    })
    await new Promise<void>((resolve) => upstream.listen(0, 'localhost', resolve))
    const storagePort = (upstream.address() as { port: number }).port
    process.env.PRODUCTS_BUNNY_STORAGE_ENDPOINT = `http://localhost:${storagePort}`
    Object.assign(globalThis, h3, {
      useRuntimeConfig: () => ({ portalAuth: {}, portalDemo: { enabled: false }, portalEmail: {} })
    })
    const db = new Client({ connectionString: url })
    await db.connect()
    let pool: { end: () => Promise<void> } | undefined
    let server: ReturnType<typeof createServer> | undefined
    try {
      for (const name of ['core', 'products']) {
        const directory = new URL(`../../${name}/migrations/`, import.meta.url)
        for (const file of (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort()) {
          await db.query(await readFile(new URL(file, directory), 'utf8'))
        }
      }
      await db.query(
        `INSERT INTO public.organization(id,name,slug,created_at,organization_type,logo) VALUES('store','Store','store',now(),'PROVIDER','https://images.example.test/provider.png')`
      )
      await db.query(
        `INSERT INTO public."user"(id,name,email,email_verified) VALUES('owner','Owner','owner@example.test',true)`
      )
      await db.query(
        `INSERT INTO products.store(organization_id,actor_id,enabled,checkout_appearance) VALUES('store','owner',true,'{"hostName":"Media order preview"}')`
      )
      const links = [
        {
          id: 'b84e1b42-704b-4aa8-bf2c-906ca3254877',
          labels: { en: 'Practice video', nl: 'Oefenvideo' },
          url: 'https://youtu.be/jNQXAC9IVRw'
        }
      ]
      const product = {
        ...emptyProduct(),
        slug: 'practice',
        imageIds: ['cover'],
        thumbnailImageId: 'cover',
        fileIds: ['audio', 'video'],
        fileNames: { audio: { en: 'Guided practice', nl: 'Begeleide oefening' } },
        links,
        nextSteps: { en: 'Enjoy your practice', nl: 'Geniet van je oefening' }
      }
      await db.query(`INSERT INTO products.product(id,store_id,slug,data) VALUES('product','store','practice',$1)`, [
        product
      ])
      await db.query(
        `INSERT INTO products.price(id,product_id,currency,amount,tax_behavior) VALUES('price','product','EUR',1200,'inclusive')`
      )
      await db.query(
        `INSERT INTO products.orders(id,store_id,request_id,request_hash,email,snapshot,status,total,refunded,notified,processing) VALUES('order','store','request','hash','private-buyer@example.test',$1,'paid',1700,500,true,'complete')`,
        [{ locale: 'nl', billing: { name: 'Private Buyer', address: 'Private address' } }]
      )
      const snapshot = { product, title: 'Guided practice', price: { currency: 'EUR' } }
      await db.query(
        `INSERT INTO products.order_line(id,order_id,position,product_id,price_id,quantity,snapshot,unit_amount,total) VALUES('line','order',0,'product','price',1,$1,1200,1200)`,
        [snapshot]
      )
      await db.query(
        `INSERT INTO products.order_line(id,order_id,position,product_id,price_id,quantity,snapshot,unit_amount,total,refunded) VALUES('refunded','order',1,'product','price',1,$1,500,500,500)`,
        [{ ...snapshot, title: 'Returned item' }]
      )
      await db.query(
        `INSERT INTO products.asset(id,product_id,name,content_type,size,visibility,object_key,ready) VALUES('audio','product','practice.mp3','audio/mpeg',10,'private','audio.mp3',true),('video','product','practice.mp4','video/mp4',10,'private','video.mp4',true),('cover','product','cover.jpg','image/jpeg',100,'public','cover.jpg',true)`
      )
      const { orderDownloadToken } = await import('../server/utils/downloads')
      pool = (await import('@nuxt-customer-portal/core/server/utils/db')).pool
      const detailsHandler = (await import('../server/api/store/purchases/[token]/details.get')).default
      const fileHandler = (await import('../server/api/store/purchases/[token]/files/[assetId].get')).default
      const app = h3.createApp()
      const router = h3.createRouter()
      router.get('/api/store/purchases/:token/details', detailsHandler)
      router.get('/api/store/purchases/:token/files/:assetId', fileHandler)
      app.use(router)
      server = createServer(h3.toNodeListener(app))
      await new Promise<void>((resolve) => server!.listen(0, 'localhost', resolve))
      process.env.BETTER_AUTH_URL = `http://localhost:${(server.address() as { port: number }).port}`
      const token = await orderDownloadToken('order')
      const origin = process.env.BETTER_AUTH_URL
      const detailsUrl = `${origin}/api/store/purchases/${token}/details`
      const get = () => fetch(detailsUrl)
      const first = await get()
      assert.equal(first.status, 200)
      assert.equal(first.headers.get('cache-control'), 'private, no-store')
      assert.equal(first.headers.get('referrer-policy'), 'no-referrer')
      assert.match(first.headers.get('x-robots-tag')!, /noindex/)
      const order = (await first.json()) as PublicOrderDetails
      assert.equal(order.locale, 'nl')
      assert.equal(order.storeMode, undefined)
      await db.query(
        `UPDATE products.orders SET snapshot=jsonb_set(snapshot,'{storeMode}','"sandbox"') WHERE id='order'`
      )
      await db.query(`UPDATE products.store SET mode='live'`)
      assert.equal(((await (await get()).json()) as PublicOrderDetails).storeMode, 'sandbox')
      await db.query(`UPDATE products.orders SET snapshot=jsonb_set(snapshot,'{storeMode}','"live"') WHERE id='order'`)
      await db.query(`UPDATE products.store SET mode='sandbox'`)
      assert.equal(((await (await get()).json()) as PublicOrderDetails).storeMode, 'live')
      assert.equal(order.appearance.logoUrl, 'https://images.example.test/provider.png')
      assert.equal(order.appearance.hostName, 'Media order preview')
      assert.equal(order.items[0]?.thumbnailImage, 'https://images.example.test/cover.jpg')
      const uploadedLogo = 'data:image/png;base64,aGVsbG8='
      await db.query('UPDATE public.organization SET logo=$1 WHERE id=$2', [uploadedLogo, 'store'])
      assert.equal(((await (await get()).json()) as PublicOrderDetails).appearance.logoUrl, uploadedLogo)
      await db.query(`UPDATE products.store SET checkout_appearance=checkout_appearance || $1::jsonb`, [
        { logoUrl: 'https://images.example.test/custom.png' }
      ])
      assert.equal(
        ((await (await get()).json()) as PublicOrderDetails).appearance.logoUrl,
        'https://images.example.test/custom.png'
      )
      assert.equal(order.items[0]?.files[0]?.size, 10)
      assert.equal(order.items[0]?.files[0]?.name, 'Begeleide oefening.mp3')
      assert.equal(order.items[0]?.files[1]?.content_type, 'video/mp4')
      assert.equal(order.items[0]?.links[0]?.name, 'Oefenvideo')
      assert.equal(order.items[0]?.nextSteps, 'Geniet van je oefening')
      const texts = await import('../server/utils/page-texts')
      await texts.savePageText('store', {
        page: 'order-details',
        locale: 'nl',
        copy: { title: 'Je materialen', downloadLabel: 'Bewaren' }
      })
      const updatedWording = (await (await get()).json()) as PublicOrderDetails
      assert.equal(updatedWording.copy.title, 'Je materialen')
      assert.equal(updatedWording.copy.downloadLabel, 'Bewaren')
      assert.equal(updatedWording.items[0]?.nextSteps, 'Geniet van je oefening')
      assert.equal(updatedWording.items[0]?.files[0]?.name, order.items[0]?.files[0]?.name)
      await texts.savePageText('store', {
        page: 'order-details',
        locale: 'nl',
        productSlug: 'practice',
        copy: { content: 'Welkom bij je oefeningen' }
      })
      assert.equal(((await (await get()).json()) as PublicOrderDetails).copy.content, 'Welkom bij je oefeningen')
      await db.query(
        `UPDATE products.order_line SET snapshot=jsonb_set(snapshot,'{product,slug}','"different"') WHERE id='refunded'`
      )
      assert.equal(((await (await get()).json()) as PublicOrderDetails).copy.content, '')
      await db.query(
        `UPDATE products.order_line SET snapshot=jsonb_set(snapshot,'{product,slug}','"practice"') WHERE id='refunded'`
      )
      await texts.resetPageText('store', { page: 'order-details', locale: 'nl', productSlug: 'practice' })
      await texts.resetPageText('store', { page: 'order-details', locale: 'nl' })
      assert.equal(((await (await get()).json()) as PublicOrderDetails).copy.title, 'Je bestelling')

      assert.deepEqual(order.items[1]?.files, [])
      assert.deepEqual(order.items[1]?.links, [])
      assert.equal(order.items[1]?.nextSteps, '')
      assert.doesNotMatch(
        JSON.stringify(order),
        /private-buyer|Private Buyer|Private address|object_key|buyer_id|payment_id/
      )
      const file = order.items[0]!.files[0]!
      const preview = await fetch(file.previewUrl, { headers: { Range: 'bytes=2-5' } })
      assert.equal(preview.status, 206)
      assert.equal(preview.headers.get('content-range'), 'bytes 2-5/10')
      assert.equal(preview.headers.get('content-length'), '4')
      assert.match(preview.headers.get('content-disposition')!, /^inline;/)
      assert.equal(await preview.text(), '2345')
      assert.equal(upstreamRequests.at(-1), 'bytes=2-5')
      const chunked = await fetch(file.previewUrl, { headers: { Range: 'bytes=6-9' } })
      assert.equal(chunked.status, 206)
      assert.equal(chunked.headers.get('content-length'), null)
      assert.equal(await chunked.text(), '6789')
      assert.equal((await db.query('SELECT count(*) FROM products.download')).rows[0].count, '0')
      const invalidRange = await fetch(file.previewUrl, { headers: { Range: 'bytes=100-' } })
      assert.equal(invalidRange.status, 416)
      assert.equal(invalidRange.headers.get('content-range'), 'bytes */10')
      const download = await fetch(file.url)
      assert.match(download.headers.get('content-disposition')!, /^attachment;/)
      assert.equal(await download.text(), '0123456789')
      assert.equal((await db.query('SELECT count(*) FROM products.download')).rows[0].count, '1')
      await db.query(`UPDATE products.product SET data=jsonb_set(data,'{links}','[]') WHERE id='product'`)
      await db.query(`UPDATE products.store SET enabled=false`)
      assert.equal(((await (await get()).json()) as PublicOrderDetails).items[0]?.links[0]?.url, links[0]!.url)
      for (const update of [
        "status='pending'",
        "status='failed'",
        "status='paid',disputed=true",
        'disputed=false,refunded=1700'
      ]) {
        await db.query(`UPDATE products.orders SET ${update} WHERE id='order'`)
        const inaccessible = (await (await get()).json()) as PublicOrderDetails
        assert.equal(inaccessible.access, false)
        assert.ok(inaccessible.items.every((item) => !item.files.length && !item.links.length && !item.nextSteps))
        assert.equal((await fetch(file.previewUrl)).status, 404)
      }
      await db.query(`UPDATE products.orders SET status='accepted',disputed=false,refunded=500 WHERE id='order'`)
      assert.equal(((await (await get()).json()) as PublicOrderDetails).access, true)
      await db.query(`UPDATE products.asset SET ready=false WHERE id='audio'`)
      assert.equal(((await (await get()).json()) as PublicOrderDetails).items[0]?.filesPending, true)
      assert.equal((await fetch(`${origin}/api/store/purchases/invalid/details`)).status, 404)
      assert.equal((await fetch(`${origin}/api/store/purchases/${'0'.repeat(64)}/details`)).status, 404)
    } finally {
      await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()))
      await new Promise<void>((resolve) => upstream.close(() => resolve()))
      await db.end()
      await pool?.end()
      hook.deregister()
    }
  }
)
