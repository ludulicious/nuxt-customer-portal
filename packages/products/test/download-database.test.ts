import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import { Client } from 'pg'
import { emptyProduct } from '../shared/validation'

test(
  'purchase permalinks authorize snapshot files and persist actual delivery requests',
  { skip: !process.env.PRODUCTS_DOWNLOAD_TEST_DATABASE_URL },
  async () => {
    const url = process.env.PRODUCTS_DOWNLOAD_TEST_DATABASE_URL!
    assert.match(new URL(url).pathname, /^\/codex_products_test_/)
    process.env.DATABASE_URL = url
    process.env.BETTER_AUTH_URL = 'http://localhost:3059'
    process.env.BETTER_AUTH_SECRET = 'products-test-secret-with-at-least-thirty-two-characters'
    process.env.PRODUCTS_S3_BUCKET = 'downloads-test'
    process.env.PRODUCTS_S3_ENDPOINT = 'http://localhost:55999'
    process.env.AWS_ACCESS_KEY_ID = 'test-key'
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret'
    Object.assign(globalThis, {
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
      const product = {
        ...emptyProduct(),
        fileIds: ['file'],
        fileNames: { file: { en: 'My audio', nl: 'Mijn audio' } }
      }
      await db.query(`INSERT INTO products.product(id,store_id,slug,data) VALUES('product','store','audio',$1)`, [
        product
      ])
      await db.query(
        `INSERT INTO products.price(id,product_id,currency,amount,tax_behavior) VALUES('price','product','EUR',1000,'exclusive')`
      )
      await db.query(
        `INSERT INTO products.orders(id,store_id,request_id,request_hash,email,snapshot) VALUES('order','store','request','hash','buyer@example.test',$1)`,
        [{ locale: 'en' }]
      )
      await db.query(
        `INSERT INTO products.order_line(id,order_id,position,product_id,price_id,quantity,snapshot,unit_amount,total) VALUES('line','order',0,'product','price',1,$1,1000,1000)`,
        [{ product, title: 'Audio', price: { currency: 'EUR' } }]
      )
      await db.query(
        `INSERT INTO products.asset(id,product_id,name,content_type,size,visibility,object_key,ready) VALUES('file','product','audio.mp3','audio/mpeg',100,'private','audio.mp3',true)`
      )
      const { orderDownloadToken, downloadOrder, purchaseDownloads, sendPurchasedAsset } =
        await import('../server/utils/downloads')
      pool = (await import('@nuxt-customer-portal/core/server/utils/db')).pool
      const token = await orderDownloadToken('order')
      assert.match(token, /^[a-f0-9]{64}$/)
      assert.equal(await orderDownloadToken('order'), token)
      await assert.rejects(downloadOrder('invalid'), { statusCode: 404 })
      await assert.rejects(downloadOrder('0'.repeat(64)), { statusCode: 404 })
      assert.deepEqual(await purchaseDownloads(await downloadOrder(token), token), [])
      await db.query("UPDATE products.orders SET status='paid',total=1000 WHERE id='order'")
      const files = await purchaseDownloads(await downloadOrder(token), token)
      assert.deepEqual(files, [
        { id: 'file', name: 'My audio.mp3', url: `http://localhost:3059/api/store/purchases/${token}/files/file` }
      ])
      // Later catalog changes must not grant access to extra files.
      await db.query(
        "UPDATE products.product SET data=jsonb_set(data,'{fileIds}','[\"different\"]') WHERE id='product'"
      )
      assert.deepEqual(await purchaseDownloads(await downloadOrder(token), token), files)
      const { H3Event } = await import('h3')
      const event = () => new H3Event(new Request('http://localhost/download'))
      await sendPurchasedAsset(event(), await downloadOrder(token), 'file', 'public')
      let records = (await db.query('SELECT * FROM products.download')).rows
      assert.equal(records.length, 1)
      assert.equal(records[0].source, 'public')
      assert.equal(records[0].order_id, 'order')
      assert.equal(records[0].order_line_id, 'line')
      assert.equal(records[0].asset_id, 'file')
      assert.ok(records[0].created_at)
      await sendPurchasedAsset(event(), await downloadOrder(token), 'file', 'portal', false)
      assert.equal((await db.query('SELECT count(*) FROM products.download')).rows[0].count, '1')
      await sendPurchasedAsset(event(), await downloadOrder(token), 'file', 'portal')
      records = (await db.query('SELECT * FROM products.download ORDER BY created_at')).rows
      assert.equal(records.length, 2)
      assert.equal(records[1].source, 'portal')
      await db.query("UPDATE products.orders SET disputed=true WHERE id='order'")
      assert.deepEqual(await purchaseDownloads(await downloadOrder(token), token), [])
      await assert.rejects(sendPurchasedAsset(event(), await downloadOrder(token), 'file', 'public'), {
        statusCode: 404
      })
      await db.query("UPDATE products.orders SET disputed=false WHERE id='order'")
      await db.query("UPDATE products.order_line SET refunded=1000 WHERE id='line'")
      assert.deepEqual(await purchaseDownloads(await downloadOrder(token), token), [])
      await db.query("UPDATE products.order_line SET refunded=0 WHERE id='line'")
      await assert.rejects(sendPurchasedAsset(event(), await downloadOrder(token), 'unrelated', 'public'), {
        statusCode: 404
      })
      await db.query("UPDATE products.asset SET ready=false WHERE id='file'")
      await assert.rejects(sendPurchasedAsset(event(), await downloadOrder(token), 'file', 'public'), {
        statusCode: 404
      })
      assert.equal((await db.query('SELECT count(*) FROM products.download')).rows[0].count, '2')
    } finally {
      await db.end()
      await pool?.end()
    }
  }
)
