import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import {
  emptyProduct,
  productSchema,
  productContentSchema,
  productPricingSchema,
  productCreateSchema,
  priceSchema,
  checkoutSchema,
  settingsSchema,
  hasRequiredPrices
} from '../shared/validation'
import { fileExtension, withoutFileExtension, withFileExtension } from '../shared/file-name'
import { currencyScale, formatMoney } from '../shared/money'
import { hasPurchaseAccess } from '../shared/access'
import { checkoutAppearanceSchema } from '../shared/checkout-appearance'
import { resolveCheckoutQuery, resolveCheckoutReturnUrl } from '../shared/checkout-query'

test('product detail keeps edit, lifecycle and deletion actions in distinct page regions', () => {
  const page = readFileSync(new URL('../app/pages/admin/products/[id]/index.vue', import.meta.url), 'utf8')
  const details = readFileSync(new URL('../app/components/ProductsDetailsCard.vue', import.meta.url), 'utf8')
  const status = readFileSync(new URL('../app/components/ProductsStatusCard.vue', import.meta.url), 'utf8')
  const danger = readFileSync(new URL('../app/components/ProductsDangerCard.vue', import.meta.url), 'utf8')

  assert.doesNotMatch(page, /#actions/)
  assert.match(page, /<ProductsDetailsCard[\s\S]*@edit="toggleEdit\('details'\)"/)
  assert.match(page, /<template #status>[\s\S]*<ProductsStatusCard/)
  assert.match(page, /<ProductsDangerCard/)
  assert.match(details, /#header>[\s\S]*\$emit\('edit'\)/)
  assert.doesNotMatch(details, /changeStatus|ProductsDelete/)
  assert.match(status, /ProductsPublishDialog/)
  assert.doesNotMatch(status, /<UCard/)
  assert.match(details, /<slot name="status"/)
  assert.match(status, /v-if="statusConfirmOpen"/)
  assert.match(status, /v-model:open="statusConfirmOpen"/)
  assert.match(status, /@confirm="confirmStatusChange"/)
  assert.match(danger, /<ProductsDelete/)
})

test('product deletion uses a full-width destructive action and exact-name confirmation', () => {
  const source = readFileSync(new URL('../app/components/ProductsDelete.vue', import.meta.url), 'utf8')

  assert.match(source, /<UButton block color="error" variant="outline"/)
  assert.match(source, /value === productName\.value/)
  assert.match(source, /:disabled="busy \|\| !nameMatches"/)
  assert.match(source, /:placeholder="productName"/)
})

test('product edit buttons use Nuxt UI soft styling for interaction feedback', () => {
  for (const component of [
    'ProductsDetailsCard.vue',
    'ProductsPriceCard.vue',
    'ProductsPlanningCard.vue',
    'ProductsPreviewCard.vue',
    'ProductsFilesSection.vue'
  ]) {
    const source = readFileSync(new URL(`../app/components/${component}`, import.meta.url), 'utf8')
    assert.match(source, /i-lucide-pencil[\s\S]{0,200}color="neutral"[\s\S]{0,100}variant="soft"/)
    assert.doesNotMatch(source, /hover:bg-elevated|active:bg-accented/)
  }
})

test('product image tabs are visually and accessibly joined to their panel', () => {
  const source = readFileSync(new URL('../app/components/ProductsImageLibrary.vue', import.meta.url), 'utf8')

  assert.match(source, /overflow-hidden rounded-t-lg border border-b-0/)
  assert.match(source, /role="tabpanel"/)
  assert.match(source, /rounded-b-lg border border-t-0 border-default/)
  assert.doesNotMatch(source, /grid gap-1 rounded-t-lg|rounded-md px-3 py-2\.5 text-left/)
  assert.match(source, /:aria-controls="`product-image-panel-\$\{purpose\}`"/)
  assert.match(source, /:aria-labelledby="`product-image-tab-\$\{activePurpose\}`"/)
  assert.match(source, /const activePurpose = ref<ImagePurpose>\('thumbnail'\)/)
  assert.match(source, /thumbnailImageId\.value \|\| imageIds\.value\.find/)
})

test('image editing uses a dirty-aware back-to-product flow', () => {
  const detail = readFileSync(new URL('../app/pages/admin/products/[id]/index.vue', import.meta.url), 'utf8')
  const page = readFileSync(new URL('../app/pages/admin/products/[id]/images.vue', import.meta.url), 'utf8')
  const form = readFileSync(new URL('../app/components/ProductsForm.vue', import.meta.url), 'utf8')

  assert.match(detail, /\/admin\/products\/\$\{route\.params\.id\}\/images/)
  assert.doesNotMatch(detail, /editing === 'images'|unsavedImagesOpen/)
  assert.match(page, /products\.backToProduct/)
  assert.match(page, /v-if="unsavedOpen"/)
  assert.match(page, /@click="saveAndClose"/)
  assert.match(page, /@click="discard"/)
  assert.match(form, /dirty: \[dirty: boolean\]/)
  assert.match(page, /saveRequest\.value \+= 1/)
  assert.match(page, /:save-request="saveRequest"/)
  assert.match(form, /\(\) => props\.saveRequest/)
  assert.match(form, /void save\(\)/)
  assert.match(page, /await navigateTo\(productTarget\.value\)/)
})

test('product pricing selector includes store currencies without an active price', () => {
  const page = readFileSync(new URL('../app/pages/admin/products/[id]/index.vue', import.meta.url), 'utf8')

  assert.match(page, /const currencyOptions = computed\(\(\) => preview\.value\?\.currencies \|\| \[\]\)/)
  assert.doesNotMatch(page, /product\.value\?\.prices\.map\(\(price\) => price\.currency\)/)
})

test('checkout appearance has safe reusable defaults and validates URLs', () => {
  const appearance = checkoutAppearanceSchema.parse({})
  assert.equal(appearance.actionColor, '#563273')
  assert.equal(checkoutAppearanceSchema.safeParse({ logoUrl: 'javascript:alert(1)' }).success, false)
  assert.equal(checkoutAppearanceSchema.safeParse({ actionColor: 'url(javascript:alert(1))' }).success, false)
  assert.equal(
    checkoutAppearanceSchema.safeParse({ returnUrl: 'https://shannonchapoy.com/specials/path' }).success,
    true
  )
})

test('checkout query accepts supported host preferences and falls back safely', () => {
  assert.deepEqual(resolveCheckoutQuery({ locale: 'nl', currency: 'usd' }), { locale: 'nl', currency: 'USD' })
  assert.deepEqual(resolveCheckoutQuery({ locale: 'fr', currency: 'BTC' }), { locale: 'en', currency: undefined })
})

test('checkout return URLs preserve exact host paths without allowing open redirects', () => {
  const configured = 'https://shannonchapoy.com/services'
  assert.equal(
    resolveCheckoutReturnUrl('https://shannonchapoy.com/specials/intake?source=home', configured),
    'https://shannonchapoy.com/specials/intake?source=home'
  )
  assert.equal(resolveCheckoutReturnUrl('https://attacker.example/phishing', configured), configured)
  assert.equal(resolveCheckoutReturnUrl('javascript:alert(1)', configured), configured)
  assert.equal(
    resolveCheckoutReturnUrl('http://localhost:3000/specials/intake', configured),
    'http://localhost:3000/specials/intake'
  )
})

test('publishing requires translated identity, a price and digital delivery', () => {
  const product = emptyProduct()
  product.slug = 'audio'
  product.content.en.title = 'Audio'
  product.imageIds = ['image']
  product.thumbnailImageId = 'image'
  product.galleryImageIds = ['image']
  product.detailImageIds = ['image']
  assert.equal(productSchema.safeParse(product).success, true)
  assert.equal(productSchema.safeParse({ ...product, status: 'published' }).success, false)
  assert.equal(productSchema.safeParse({ ...product, status: 'published', fileIds: ['file'] }).success, true)
  assert.equal(productSchema.safeParse({ ...product, type: 'service', status: 'published' }).success, true)
  assert.equal(productSchema.safeParse({ ...product, prices: [product.prices[0], product.prices[0]] }).success, false)
  assert.equal(productSchema.safeParse({ ...product, videoUrl: 'javascript:alert(1)' }).success, false)
})
test('currency pricing preserves zero- and three-decimal units', () => {
  assert.equal(currencyScale('JPY'), 1)
  assert.equal(currencyScale('KWD'), 1000)
  assert.equal(currencyScale('EUR'), 100)
  assert.match(formatMoney(1234, 'KWD', 'en'), /1\.234/)
  for (const amount of [0, -1, 1.5, Infinity]) {
    assert.equal(priceSchema.safeParse({ currency: 'EUR', amount, taxBehavior: 'inclusive' }).success, false)
  }
  assert.equal(priceSchema.safeParse({ currency: 'XXX', amount: 100, taxBehavior: 'inclusive' }).success, false)
})
test('checkout rejects incomplete billing and does not accept browser prices', () => {
  const input = {
    productId: 'product',
    priceId: 'price',
    requestId: 'a14c2702-8eb1-40bd-81ce-5ad49b86e611',
    locale: 'nl',
    billing: {
      type: 'person',
      firstName: 'Test',
      lastName: 'Buyer',
      name: 'Buyer',
      email: 'BUYER@example.test',
      company: '',
      address: 'Street 1, 1234 AB Amsterdam',
      country: 'NL',
      registrationNumber: '',
      vatNumber: ''
    }
  }
  assert.equal(checkoutSchema.parse({ ...input, amount: 1 }).billing.email, 'buyer@example.test')
  assert.equal('amount' in checkoutSchema.parse({ ...input, amount: 1 }), false)
  assert.equal(
    checkoutSchema.safeParse({ ...input, billing: { ...input.billing, type: 'organization' } }).success,
    false
  )
})
test('payment state gates access including full refunds and disputes', () => {
  const paid = { status: 'paid' as const, total: 1000, refunded: 0, disputed: false }
  assert.equal(hasPurchaseAccess(paid), true)
  assert.equal(hasPurchaseAccess({ ...paid, refunded: 500 }), true)
  assert.equal(hasPurchaseAccess({ ...paid, refunded: 1000 }), false)
  assert.equal(hasPurchaseAccess({ ...paid, disputed: true }), false)
  assert.equal(hasPurchaseAccess({ ...paid, status: 'pending' }), false)
  assert.equal(hasPurchaseAccess({ ...paid, total: null }), false)
  assert.equal(hasPurchaseAccess(paid, { total: 600, refunded: 600 }), false)
  assert.equal(hasPurchaseAccess({ ...paid, refunded: 500 }, { total: 600, refunded: 0 }), true)
})
test('commerce schema uses multi-item orders and persisted carts', () => {
  const migration = readFileSync(new URL('../migrations/0000_baseline.sql', import.meta.url), 'utf8')
  assert.doesNotMatch(migration, /products\.purchase/)
  assert.match(migration, /CREATE TABLE products\.orders/)
  assert.match(migration, /CREATE TABLE products\.order_line/)
  assert.match(migration, /quantity integer NOT NULL CHECK\(quantity>0\)/)
  assert.match(migration, /CREATE TABLE products\.cart/)
  assert.match(migration, /CREATE TABLE products\.cart_line/)
  assert.match(migration, /FOREIGN KEY\(cart_id\) REFERENCES products\.cart\(id\)/)
})
test('legacy product API keys are removed by a forward migration', () => {
  const migration = readFileSync(new URL('../migrations/0013_drop_legacy_api_keys.sql', import.meta.url), 'utf8')
  assert.match(migration, /DROP TABLE IF EXISTS products\.api_key/)
})
test('orders receive a unique customer-facing booking reference', () => {
  const migration = readFileSync(new URL('../migrations/0016_order_booking_reference.sql', import.meta.url), 'utf8')
  assert.match(migration, /ADD COLUMN booking_reference text/)
  assert.match(migration, /CREATE UNIQUE INDEX orders_booking_reference/)
  assert.match(migration, /ALTER COLUMN booking_reference SET NOT NULL/)
})
test('English and Dutch provide matching interface translations', () => {
  const en = JSON.parse(readFileSync(new URL('../i18n/locales/en.json', import.meta.url), 'utf8')).products
  const nl = JSON.parse(readFileSync(new URL('../i18n/locales/nl.json', import.meta.url), 'utf8')).products
  assert.deepEqual(Object.keys(en).sort(), Object.keys(nl).sort())
})

test('store currencies are required and paid products cover every currency', () => {
  assert.equal(settingsSchema.safeParse({ enabled: false, defaultLocale: 'en', currencies: [] }).success, false)
  assert.equal(
    settingsSchema.safeParse({ enabled: false, defaultLocale: 'en', currencies: ['EUR', 'EUR'] }).success,
    false
  )
  assert.equal(
    settingsSchema.safeParse({ enabled: false, defaultLocale: 'en', currencies: ['EUR', 'USD'] }).success,
    true
  )
  assert.equal(hasRequiredPrices(emptyProduct(), ['EUR', 'USD']), false)
  assert.equal(
    hasRequiredPrices(
      {
        prices: [
          { currency: 'EUR', amount: 100 },
          { currency: 'USD', amount: 0 }
        ]
      },
      ['EUR', 'USD']
    ),
    false
  )
  assert.equal(
    hasRequiredPrices(
      {
        prices: [
          { currency: 'EUR', amount: 100 },
          { currency: 'USD', amount: 200 }
        ]
      },
      ['EUR', 'USD']
    ),
    true
  )
  const free = {
    ...emptyProduct(),
    slug: 'free',
    content: { en: { title: 'Free', summary: '', description: '' }, nl: { title: '', summary: '', description: '' } },
    isFree: true,
    prices: []
  }
  assert.equal(productSchema.safeParse(free).success, true)
  assert.equal(hasRequiredPrices(free, ['EUR', 'USD']), true)
  assert.equal(productSchema.safeParse({ ...free, isFree: false }).success, true)
  for (const prices of [[], [{ currency: 'EUR', amount: 0, taxBehavior: 'inclusive' }]]) {
    const paid = { ...free, isFree: false, type: 'service', prices }
    assert.equal(productSchema.safeParse(paid).success, true)
    assert.equal(productSchema.safeParse({ ...paid, status: 'published' }).success, false)
  }
  assert.equal(hasPurchaseAccess({ status: 'paid', total: 0, refunded: 0, disputed: false }), true)
  assert.equal(hasPurchaseAccess({ status: 'pending', total: 0, refunded: 0, disputed: false }), false)
})

test('new stores default to sandbox mode and reject unknown environments', () => {
  const settings = { enabled: false, defaultLocale: 'en', languages: ['en'], currencies: ['EUR'] }
  assert.equal(settingsSchema.parse(settings).mode, 'sandbox')
  assert.equal(settingsSchema.safeParse({ ...settings, mode: 'live' }).success, true)
  assert.equal(settingsSchema.safeParse({ ...settings, mode: 'preview' }).success, false)
})

test('store languages require a supported default and preserve bilingual defaults', () => {
  const settings = { enabled: false, defaultLocale: 'en', currencies: ['EUR'] }
  assert.deepEqual(settingsSchema.parse(settings).languages, ['en', 'nl'])
  assert.equal(settingsSchema.safeParse({ ...settings, languages: [] }).success, false)
  assert.equal(settingsSchema.safeParse({ ...settings, languages: ['en', 'en'] }).success, false)
  assert.equal(settingsSchema.safeParse({ ...settings, languages: ['fr'] }).success, false)
  assert.equal(settingsSchema.safeParse({ ...settings, languages: ['nl'] }).success, false)
  assert.equal(settingsSchema.safeParse({ ...settings, defaultLocale: 'nl', languages: ['nl'] }).success, true)
})

test('store tax treatment accepts independent settings per supported currency', () => {
  const settings = { enabled: false, defaultLocale: 'en', currencies: ['EUR', 'USD'] }
  assert.equal(
    settingsSchema.safeParse({ ...settings, currencyTaxBehavior: { EUR: 'inclusive', USD: 'exclusive' } }).success,
    true
  )
  assert.equal(settingsSchema.safeParse({ ...settings, currencyTaxBehavior: { EUR: 'invalid' } }).success, false)
  assert.equal(settingsSchema.safeParse({ ...settings, currencyTaxBehavior: { XXX: 'inclusive' } }).success, false)
})

test('new products require a category, while existing uncategorized drafts remain editable', () => {
  const product = { ...emptyProduct(), slug: 'new-product' }
  product.content.en.title = 'New product'
  assert.equal(productCreateSchema.safeParse(product).success, false)
  assert.equal(productCreateSchema.safeParse({ ...product, categoryId: 'category-id' }).success, true)
  assert.equal(productSchema.safeParse(product).success, true)
})

test('subtitles are optional, localized and limited to 200 characters', () => {
  const product = emptyProduct()
  product.slug = 'subtitle-example'
  product.content.en.title = 'Example'
  product.content.en.subtitle = 'Your next step'
  product.content.nl.subtitle = 'Jouw volgende stap'
  const parsed = productSchema.parse(product)
  assert.equal(parsed.content.en.subtitle, 'Your next step')
  assert.equal(parsed.content.nl.subtitle, 'Jouw volgende stap')
  const { subtitle: _subtitle, ...legacyCopy } = product.content.en
  assert.equal(
    productSchema.parse({ ...product, content: { ...product.content, en: legacyCopy } }).content.en.subtitle,
    ''
  )
  product.content.en.subtitle = 'a'.repeat(201)
  assert.equal(productSchema.safeParse(product).success, false)
})

test('customer-facing file names omit the source extension', () => {
  assert.equal(fileExtension('document.final.PDF'), '.PDF')
  assert.equal(withoutFileExtension('My document.pdf', 'original.pdf'), 'My document')
  assert.equal(withoutFileExtension('My document.PDF', 'original.pdf'), 'My document')
  assert.equal(withoutFileExtension('My document', 'original.pdf'), 'My document')
  assert.equal(withFileExtension('My document.pdf', 'original.pdf'), 'My document.pdf')
  assert.equal(withFileExtension('My document', 'original.pdf'), 'My document.pdf')
})

test('product text edits validate content independently of publish media requirements', () => {
  const product = emptyProduct()
  product.status = 'published'
  product.isFree = true
  product.content.en.title = 'Free consultation'
  assert.equal(productSchema.safeParse(product).success, false)
  assert.equal(productContentSchema.safeParse(product).success, true)
  product.content.en.title = ''
  assert.equal(productContentSchema.safeParse(product).success, false)
})

test('pricing validation loads independently and accepts free or paid inputs', () => {
  assert.equal(productPricingSchema.safeParse({ isFree: true, prices: [] }).success, true)
  assert.equal(
    productPricingSchema.safeParse({
      isFree: false,
      prices: [{ currency: 'EUR', amount: 2500, taxBehavior: 'inclusive' }]
    }).success,
    true
  )
  assert.equal(
    productPricingSchema.safeParse({
      isFree: false,
      prices: [{ currency: 'EUR', amount: -1, taxBehavior: 'inclusive' }]
    }).success,
    false
  )
})
