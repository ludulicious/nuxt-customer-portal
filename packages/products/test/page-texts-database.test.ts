import assert from 'node:assert/strict'
import test from 'node:test'
import { readdir, readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { registerHooks } from 'node:module'
import { Client } from 'pg'
import { defaultOrderPageCopy } from '../shared/page-texts'

test(
  'page-text migration, store/language isolation, default resets and public/admin API boundaries',
  { skip: !process.env.PRODUCTS_PAGE_TEXTS_TEST_DATABASE_URL },
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
    const url = process.env.PRODUCTS_PAGE_TEXTS_TEST_DATABASE_URL!
    assert.match(new URL(url).pathname, /^\/codex_products_test_/)
    process.env.DATABASE_URL = url
    process.env.BETTER_AUTH_URL = 'http://localhost:3059'
    process.env.BETTER_AUTH_SECRET = 'page-texts-test-secret-with-at-least-thirty-two-characters'
    Object.assign(globalThis, h3, {
      useRuntimeConfig: () => ({
        public: { clients: { allowedTypes: ['person', 'organization'], personalSelfRegistration: false } },
        portalAuth: {},
        portalDemo: { enabled: false },
        portalEmail: {}
      })
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
        `INSERT INTO public.organization(id,name,slug,created_at,organization_type) VALUES('store','Store','store',now(),'PROVIDER'),('other','Other','other',now(),'CLIENT')`
      )
      await db.query(
        `INSERT INTO public."user"(id,name,email,email_verified) VALUES('owner','Owner','owner@example.test',true)`
      )
      await db.query(`INSERT INTO products.store(organization_id,actor_id,enabled) VALUES('store','owner',true)`)
      const texts = await import('../server/utils/page-texts')
      const legacy = await import('../server/utils/thank-you')
      pool = (await import('@nuxt-customer-portal/core/server/utils/db')).pool
      await legacy.saveThankYouText('store', {
        productSlug: 'audio',
        locale: 'en',
        variant: 'free',
        copy: { heading: 'Existing custom heading' }
      })
      const english = {
        page: 'order-details',
        locale: 'en',
        copy: {
          title: ' Your library ',
          content: '# Welcome\n\nEnjoy **your materials**.\n\n<script>alert(1)</script>',
          footer: ' '
        }
      }
      const saved = await texts.savePageText('store', english)
      assert.equal(saved.copy.title, 'Your library')
      assert.equal('footer' in saved.copy, false)
      await texts.savePageText('store', { page: 'order-details', locale: 'nl', copy: { title: 'Je bibliotheek' } })
      await texts.savePageText('other', { page: 'order-details', locale: 'en', copy: { title: 'Other store' } })
      assert.equal((await texts.orderPageCopy('store', 'nl')).title, 'Je bibliotheek')
      assert.equal((await texts.orderPageCopy('other', 'en')).title, 'Other store')
      await texts.savePageText('store', {
        page: 'order-details',
        locale: 'en',
        productSlug: 'audio',
        copy: { content: 'Audio introduction' }
      })
      assert.equal((await texts.orderPageCopy('store', 'en', 'audio')).title, 'Your library')
      assert.equal((await texts.orderPageCopy('store', 'en', 'audio')).content, 'Audio introduction')
      assert.equal((await texts.orderPageCopy('store', 'en', 'video')).title, 'Your library')
      await texts.resetPageText('store', { page: 'order-details', locale: 'en', productSlug: 'audio' })
      assert.equal((await texts.orderPageCopy('store', 'en', 'audio')).title, 'Your library')
      assert.equal((await texts.orderPageCopy('store', 'en')).title, 'Your library')
      const copy = await texts.orderPageCopy('store', 'en')
      assert.equal(copy.title, 'Your library')
      assert.match(copy.contentHtml, /<strong>your materials<\/strong>/)
      assert.doesNotMatch(copy.contentHtml, /<script/)
      assert.equal(copy.footer, defaultOrderPageCopy('en').footer)
      await assert.rejects(texts.savePageText('store', { ...english, storeId: 'other' }), { statusCode: 400 })
      await assert.rejects(texts.savePageText('store', { ...english, copy: { contentHtml: '<script>bad</script>' } }), {
        statusCode: 400
      })
      await assert.rejects(texts.savePageText('store', { ...english, locale: 'de' }), { statusCode: 400 })
      const publicHandler = (await import('../server/api/store/page-texts/order-details.get')).default
      const getHandler = (await import('../server/api/products/admin/page-texts/index.get')).default
      const putHandler = (await import('../server/api/products/admin/page-texts/index.put')).default
      const deleteHandler = (await import('../server/api/products/admin/page-texts/index.delete')).default
      const previewHandler = (await import('../server/api/products/admin/page-texts/preview.get')).default
      const renderHandler = (await import('../server/api/products/admin/page-texts/render.post')).default
      const app = h3.createApp()
      const router = h3.createRouter()
      router.get('/api/store/page-texts/order-details', publicHandler)
      router.get('/api/products/admin/page-texts', getHandler)
      router.get('/api/products/admin/page-texts/preview', previewHandler)
      router.put('/api/products/admin/page-texts', putHandler)
      router.delete('/api/products/admin/page-texts', deleteHandler)
      router.post('/api/products/admin/page-texts/render', renderHandler)
      app.use(router)
      server = createServer(h3.toNodeListener(app))
      await new Promise<void>((resolve) => server!.listen(0, 'localhost', resolve))
      const origin = `http://localhost:${(server.address() as { port: number }).port}`
      const response = await fetch(`${origin}/api/store/page-texts/order-details?locale=nl&storeId=other`)
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('cache-control'), 'private, no-store')
      const publicCopy = await response.json()
      assert.equal(publicCopy.title, 'Je bibliotheek')
      assert.equal('storeId' in publicCopy, false)
      assert.equal((await fetch(`${origin}/api/store/page-texts/order-details?locale=de`)).status, 400)
      for (const method of ['GET', 'PUT', 'DELETE']) {
        assert.equal((await fetch(`${origin}/api/products/admin/page-texts`, { method })).status, 401)
      }
      assert.equal((await fetch(`${origin}/api/products/admin/page-texts/render`, { method: 'POST' })).status, 401)
      assert.equal((await fetch(`${origin}/api/products/admin/page-texts/preview?slug=audio&locale=en`)).status, 401)
      await texts.resetPageText('store', { page: 'order-details', locale: 'en' })
      assert.equal((await texts.orderPageCopy('store', 'en')).title, 'Your order')
      assert.equal((await texts.orderPageCopy('store', 'nl')).title, 'Je bibliotheek')
      assert.equal((await texts.orderPageCopy('other', 'en')).title, 'Other store')
      assert.equal((await legacy.thankYouTexts('store'))[0]?.copy.heading, 'Existing custom heading')
      const defaults = await texts.savePageText('store', {
        page: 'order-details',
        locale: 'en',
        copy: defaultOrderPageCopy('en')
      })
      assert.deepEqual(defaults.copy, {})
      await assert.rejects(
        db.query(`INSERT INTO products.page_text(store_id,page,locale) VALUES('store','order-details','de')`),
        { code: '23514' }
      )
    } finally {
      await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()))
      await db.end()
      await pool?.end()
      hook.deregister()
    }
  }
)
