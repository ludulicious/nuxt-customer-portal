import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import { Client } from 'pg'

test(
  'thank-you migration, scoped persistence and reset inheritance',
  { skip: !process.env.PRODUCTS_THANK_YOU_TEST_DATABASE_URL },
  async () => {
    const url = process.env.PRODUCTS_THANK_YOU_TEST_DATABASE_URL!
    assert.match(new URL(url).pathname, /^\/codex_products_test_/)
    process.env.DATABASE_URL = url
    const db = new Client({ connectionString: url })
    await db.connect()
    let pool: { end: () => Promise<void> } | undefined
    try {
      for (const name of ['core', 'products']) {
        const directory = new URL(`../../${name}/migrations/`, import.meta.url)
        for (const file of (await readdir(directory))
          .filter((f) => f.endsWith('.sql') && f !== '0021_thank_you_texts.sql')
          .sort()) {
          await db.query(await readFile(new URL(file, directory), 'utf8'))
        }
      }
      await db.query(
        `INSERT INTO public.organization(id,name,slug,created_at,organization_type) VALUES('store','Store','store',now(),'PROVIDER'),('other','Other','other',now(),'CLIENT')`
      )
      await db.query(await readFile(new URL('../migrations/0021_thank_you_texts.sql', import.meta.url), 'utf8'))
      const texts = await import('../server/utils/thank-you')
      pool = (await import('@nuxt-customer-portal/core/server/utils/db')).pool
      assert.equal((await texts.productThankYouCopies('store', 'audio', 'en')).free.heading, 'Your gift is ready')
      const base = { productSlug: '', locale: 'en' as const, variant: 'free' as const }
      await texts.saveThankYouText('store', { ...base, copy: { heading: 'Store gift', message: 'Store welcome' } })
      await texts.saveThankYouText('store', {
        ...base,
        productSlug: 'audio',
        copy: { heading: 'Your meditation', message: '' }
      })
      assert.equal((await texts.productThankYouCopies('store', 'audio', 'en')).free.heading, 'Your meditation')
      assert.equal((await texts.productThankYouCopies('store', 'audio', 'en')).free.message, 'Store welcome')
      assert.equal((await texts.productThankYouCopies('store', 'other', 'en')).free.heading, 'Store gift')
      assert.equal((await texts.productThankYouCopies('other', 'audio', 'en')).free.heading, 'Your gift is ready')
      assert.equal((await texts.productThankYouCopies('store', 'audio', 'en')).paid.heading, 'Thank you for your order')
      assert.equal(
        (await texts.productThankYouCopies('store', 'audio', 'nl')).free.heading,
        'Je cadeau staat voor je klaar'
      )
      await texts.resetThankYouText('other', { ...base, productSlug: 'audio' })
      assert.equal((await texts.productThankYouCopies('store', 'audio', 'en')).free.heading, 'Your meditation')
      await texts.resetThankYouText('store', { ...base, productSlug: 'audio' })
      assert.equal((await texts.productThankYouCopies('store', 'audio', 'en')).free.heading, 'Store gift')
      await texts.resetThankYouText('store', base)
      assert.equal((await texts.productThankYouCopies('store', 'audio', 'en')).free.heading, 'Your gift is ready')
      await texts.saveThankYouText('store', { ...base, copy: { content: '# Store welcome\n\nEnjoy **your gift**.' } })
      await texts.saveThankYouText('store', { ...base, productSlug: 'audio', copy: { content: ' ' } })
      const markdown = await texts.productThankYouCopies('store', 'audio', 'en')
      assert.match(markdown.free.contentHtml!, /<h1>Store welcome<\/h1>/)
      assert.match(markdown.free.contentHtml!, /<strong>your gift<\/strong>/)
      assert.doesNotMatch(markdown.paid.contentHtml!, /Store welcome/)
      await texts.saveThankYouText('store', { ...base, productSlug: 'audio', copy: { content: '# Audio welcome' } })
      assert.match((await texts.productThankYouCopies('store', 'audio', 'en')).free.contentHtml!, /Audio welcome/)
      await texts.resetThankYouText('store', { ...base, productSlug: 'audio' })
      assert.match((await texts.productThankYouCopies('store', 'audio', 'en')).free.contentHtml!, /Store welcome/)
      assert.equal((await db.query('SELECT count(*) FROM public.organization')).rows[0].count, '2')
    } finally {
      await db.end()
      await pool?.end()
    }
  }
)
