import { orderedProductImagePlacements, orderedProductImageIds } from '../../shared/product-media'
import { lockMediaStore } from './media-variants'
import { purchasedLinksSchema, type PurchasedLink } from '../../shared/links'
import { purchaseAppearance } from './purchase-appearance'
import { productThankYouCopies } from './thank-you'
import type { PoolClient } from 'pg'
import { effectivePricing } from '../../shared/offers'
import { productOffers, validateOutstandingOffers } from './offers'
import type { Store } from './access'
import { markdownStyleSchema } from '../../shared/markdown-style'
import { parseInput } from '@nuxt-customer-portal/products/server/utils/validation'
import { randomBytes, randomUUID } from 'node:crypto'
import { createError } from 'h3'
import { renderDescription } from './markdown'
import type { z } from 'zod'
import type { Product, ProductData, Price, Locale, CatalogProduct, Page } from '../../shared/types'
import {
  productSchema,
  productContentSchema,
  productPricingSchema,
  listSchema,
  hasRequiredPrices
} from '../../shared/validation'
import { publishChecks } from '../../shared/publish'
import { withoutFileExtension } from '../../shared/file-name'
import { rows, transaction } from './database'
import { baseUrl, getStore } from './access'
import { assetUrl } from './storage'

interface ProductRow {
  category_id: string | null
  id: string
  data: ProductData
  updated_at: string
}
export function normalizeProductImages(data: ProductData): ProductData {
  const imageIds = [...new Set(data.imageIds || [])]
  const hasPlacements = 'thumbnailImageId' in data || 'galleryImageIds' in data || 'detailImageIds' in data
  const ordered = (ids: string[] | undefined) => imageIds.filter((id) => ids?.includes(id))
  return {
    ...data,
    requiresFulfillment: data.requiresFulfillment === true,
    visibility: data.visibility || 'listed',
    imageIds,
    thumbnailImageId: imageIds.includes(data.thumbnailImageId || '')
      ? data.thumbnailImageId
      : hasPlacements
        ? null
        : imageIds[0] || null,
    galleryImageIds: hasPlacements ? ordered(data.galleryImageIds) : [...imageIds],
    detailImageIds: hasPlacements ? ordered(data.detailImageIds) : [...imageIds],
    fileNames: data.fileNames || {},
    links: data.links || []
  }
}
export const selectCopy = (data: ProductData, locale: Locale, fallback: Locale) =>
  data.content[locale].title
    ? data.content[locale]
    : data.content[fallback].title
      ? data.content[fallback]
      : data.content[locale === 'en' ? 'nl' : 'en']
export async function getProduct(storeId: string, id: string, bySlug = false, tx?: PoolClient): Promise<Product> {
  const [row] = await rows<ProductRow>(
    `SELECT * FROM products.product WHERE store_id=$1 AND ${bySlug ? 'slug' : 'id'}=$2`,
    [storeId, id],
    tx
  )
  if (!row) {
    throw createError({ statusCode: 404, message: 'Product not found' })
  }
  const prices = await rows<Price>(
    'SELECT id,currency,amount,tax_behavior AS "taxBehavior" FROM products.price WHERE product_id=$1 AND active AND offer_id IS NULL ORDER BY currency',
    [row.id],
    tx
  )
  const [category] = row.category_id
    ? await rows<{ name: string; content: Record<Locale, { name: string; description: string }> }>(
        'SELECT name,content FROM products.category WHERE store_id=$1 AND id=$2',
        [storeId, row.category_id],
        tx
      )
    : []
  return {
    ...normalizeProductImages(row.data),
    categoryId: row.category_id,
    categoryName: category?.name,
    categoryContent: category?.content,
    id: row.id,
    prices,
    offers: await productOffers(row.id, tx),
    updatedAt: row.updated_at
  }
}
export async function listProducts(
  storeId: string,
  input: unknown,
  published = false,
  listedOnly = published
): Promise<Page<Product>> {
  const q = parseInput(listSchema, input),
    params: unknown[] = [storeId],
    conditions = ['store_id=$1']
  const add = (sql: string, value: unknown) => {
    params.push(value)
    conditions.push(sql.replace('?', `$${params.length}`))
  }
  if (listedOnly) {
    conditions.push("COALESCE(data->>'visibility','listed')='listed'")
  }
  if (published) {
    add("data->>'status'=?", 'published')
  } else if (q.status) {
    add("data->>'status'=?", q.status)
  }
  if (q.type) {
    add("data->>'type'=?", q.type)
  }
  if (q.categoryId) {
    add('category_id=?', q.categoryId)
  }
  if (q.category) {
    add(
      'EXISTS(SELECT 1 FROM products.category c WHERE c.id=products.product.category_id AND c.store_id=products.product.store_id AND c.code=?)',
      q.category
    )
  }
  if (q.search) {
    add("concat_ws(' ',data->'content'->'en'->>'title',data->'content'->'nl'->>'title',slug) ILIKE ?", `%${q.search}%`)
  }
  if (q.currency) {
    add(
      'EXISTS(SELECT 1 FROM products.price pr WHERE pr.product_id=products.product.id AND pr.active AND pr.offer_id IS NULL AND pr.currency=?)',
      q.currency
    )
  }
  const where = conditions.join(' AND ')
  const [count] = await rows<{ count: string }>(`SELECT count(*) FROM products.product WHERE ${where}`, params)
  const sort = q.sortBy === 'title' ? `data->'content'->'${q.locale}'->>'title'` : 'updated_at'
  params.push((q.page - 1) * 20)
  const found = await rows<{ id: string }>(
    `SELECT id FROM products.product WHERE ${where} ORDER BY ${sort} ${q.sortDir === 'asc' ? 'ASC' : 'DESC'},id LIMIT 20 OFFSET $${params.length}`,
    params
  )
  return {
    items: await Promise.all(found.map((r) => getProduct(storeId, r.id))),
    pagination: {
      page: q.page,
      pageSize: 20,
      totalItems: Number(count!.count),
      totalPages: Math.ceil(Number(count!.count) / 20)
    }
  }
}
export async function saveProductPricing(storeId: string, id: string, input: unknown): Promise<Product> {
  const data = parseInput(productPricingSchema, input)
  await transaction(async (tx) => {
    const [store] = await rows<Store>('SELECT * FROM products.store WHERE organization_id=$1 FOR SHARE', [storeId], tx)
    if (!store) {
      throw createError({ statusCode: 403, message: 'Store access denied' })
    }
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`product:${id}`])
    const prices = data.isFree
      ? [{ currency: store.currencies[0]!, amount: 0, taxBehavior: 'inclusive' as const }]
      : data.prices
    if (
      !data.isFree &&
      (!hasRequiredPrices({ prices }, store.currencies) ||
        prices.some((p) => p.amount <= 0) ||
        new Set(prices.map((p) => p.currency)).size !== prices.length ||
        prices.some((p) => !store.currencies.includes(p.currency)))
    ) {
      throw createError({
        statusCode: 400,
        message: 'Configure a positive price for each store currency',
        data: { field: 'prices' }
      })
    }

    const [product] = await rows<ProductRow>(
      'SELECT * FROM products.product WHERE id=$1 AND store_id=$2 FOR UPDATE',
      [id, storeId],
      tx
    )
    if (!product) {
      throw createError({ statusCode: 404, message: 'Product not found' })
    }
    await validateOutstandingOffers(id, { isFree: data.isFree, prices }, store.currencies, tx)
    await tx.query(
      "UPDATE products.product SET data=jsonb_set(data,'{isFree}',to_jsonb($3::boolean)),updated_at=now() WHERE id=$1 AND store_id=$2",
      [id, storeId, data.isFree]
    )
    const active = await rows<Price>(
      'SELECT id,currency,amount,tax_behavior AS "taxBehavior" FROM products.price WHERE product_id=$1 AND active AND offer_id IS NULL',
      [id],
      tx
    )
    for (const price of prices) {
      price.taxBehavior = store.currency_tax_behavior[price.currency] || 'inclusive'
    }
    for (const old of active) {
      if (
        !prices.some((p) => p.currency === old.currency && p.amount === old.amount && p.taxBehavior === old.taxBehavior)
      ) {
        await tx.query('UPDATE products.price SET active=false WHERE id=$1', [old.id])
      }
    }
    for (const price of prices) {
      if (
        !active.some(
          (p) => p.currency === price.currency && p.amount === price.amount && p.taxBehavior === price.taxBehavior
        )
      ) {
        await tx.query(
          'INSERT INTO products.price(id,product_id,currency,amount,tax_behavior) VALUES($1,$2,$3,$4,$5)',
          [randomUUID(), id, price.currency, price.amount, price.taxBehavior]
        )
      }
    }
  })
  return getProduct(storeId, id)
}

export async function saveProductContent(storeId: string, id: string, input: unknown): Promise<Product> {
  const data = parseInput(productContentSchema, input)
  const store = await getStore()
  if (store.organization_id !== storeId) {
    throw createError({ statusCode: 403, message: 'Store access denied' })
  }
  await transaction(async (tx) => {
    const [product] = await rows<ProductRow>(
      'SELECT * FROM products.product WHERE id=$1 AND store_id=$2 FOR UPDATE',
      [id, storeId],
      tx
    )
    if (!product) {
      throw createError({ statusCode: 404, message: 'Product not found' })
    }
    if (product.data.status === 'published' && !data.content[store.default_locale].title) {
      throw createError({
        statusCode: 400,
        data: { field: `content.${store.default_locale}.title` },
        message: 'A title in the store default language is required'
      })
    }
    await rows(
      "UPDATE products.product SET data=jsonb_set(jsonb_set(data,'{content}',$3::jsonb),'{nextSteps}',$4::jsonb),updated_at=now() WHERE id=$1 AND store_id=$2",
      [id, storeId, JSON.stringify(data.content), JSON.stringify(data.nextSteps)],
      tx
    )
  })
  return getProduct(storeId, id)
}

function validateLinkLabels(links: PurchasedLink[], languages: Locale[]) {
  for (const [index, link] of links.entries()) {
    for (const language of languages) {
      if (!link.labels[language]) {
        throw createError({
          statusCode: 400,
          message: 'Add a link label in every store language',
          data: { field: `links.${index}.labels.${language}` }
        })
      }
    }
  }
}

export async function saveProductLinks(storeId: string, id: string, input: unknown): Promise<Product> {
  const links = parseInput(purchasedLinksSchema, input)
  await transaction(async (tx) => {
    const [store] = await rows<{ languages: Locale[] }>(
      'SELECT languages FROM products.store WHERE id=true AND organization_id=$1 FOR SHARE',
      [storeId],
      tx
    )
    if (!store) {
      throw createError({ statusCode: 403, message: 'Store access denied' })
    }
    validateLinkLabels(links, store.languages)
    const [product] = await rows<ProductRow>(
      'SELECT * FROM products.product WHERE id=$1 AND store_id=$2 FOR UPDATE',
      [id, storeId],
      tx
    )
    if (!product) {
      throw createError({ statusCode: 404, message: 'Product not found' })
    }
    if (
      product.data.status === 'published' &&
      product.data.type === 'digital' &&
      !product.data.fileIds.length &&
      !links.length
    ) {
      throw createError({
        statusCode: 400,
        message: 'A digital product needs a file or link',
        data: { field: 'links' }
      })
    }
    await tx.query(
      "UPDATE products.product SET data=jsonb_set(data,'{links}',$3::jsonb),updated_at=now() WHERE id=$1 AND store_id=$2",
      [id, storeId, JSON.stringify(links)]
    )
  })
  return getProduct(storeId, id)
}

export async function saveProduct(storeId: string, input: unknown, id: string = randomUUID()): Promise<Product> {
  const candidate = input as Partial<ProductData> | null
  const normalized =
    candidate?.imageSelection === 'ordered' && Array.isArray(candidate.imageIds)
      ? { ...candidate, ...orderedProductImagePlacements(candidate.imageIds) }
      : input
  const { prices: inputPrices, categoryId, ...data } = parseInput(productSchema, normalized)
  const store = await getStore()
  if (store.organization_id !== storeId) {
    throw createError({ statusCode: 403, message: 'Store access denied' })
  }
  if (data.status === 'published' && !data.content[store.default_locale].title) {
    throw createError({ statusCode: 400, message: 'A title in the store default language is required' })
  }
  const prices = data.isFree
    ? [{ currency: store.currencies[0]!, amount: 0, taxBehavior: 'inclusive' as const }]
    : inputPrices
  try {
    await transaction(async (tx) => {
      await lockMediaStore(tx, storeId)
      const [currentStore] = await rows<{
        currencies: string[]
        languages: Locale[]
        enabled: boolean
        currency_tax_behavior: Record<string, 'inclusive' | 'exclusive'>
      }>(
        'SELECT currencies, languages, enabled, currency_tax_behavior FROM products.store WHERE id=true FOR SHARE',
        [],
        tx
      )
      if (data.status === 'published') {
        const failed = publishChecks({ ...data, prices }, currentStore!).filter(
          (check) => !check.passed && !check.warning
        )
        if (failed.length) {
          throw createError({ statusCode: 400, message: 'Complete the publish checklist', data: { checks: failed } })
        }
      }
      validateLinkLabels(data.links, currentStore!.languages)
      const purchasedFiles = data.fileIds.length
        ? await rows<{ id: string; name: string }>(
            'SELECT id,name FROM products.asset WHERE product_id=$1 AND id=ANY($2::text[]) AND visibility=$3 AND ready',
            [id, data.fileIds, 'private'],
            tx
          )
        : []
      for (const fileId of data.fileIds) {
        const sourceName = purchasedFiles.find((file) => file.id === fileId)?.name || ''
        const localizedNames = (data.fileNames[fileId] ||= { en: '', nl: '' })
        for (const language of currentStore!.languages) {
          localizedNames[language] = withoutFileExtension(localizedNames[language], sourceName)
          if (!localizedNames[language]) {
            throw createError({
              statusCode: 400,
              message: 'Add a customer-facing file name in every store language',
              data: { field: `fileNames.${fileId}.${language}` }
            })
          }
        }
      }
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`categories:${storeId}`])
      if (categoryId) {
        const [category] = await rows<{ name: string }>(
          'SELECT name FROM products.category WHERE store_id=$1 AND id=$2',
          [storeId, categoryId],
          tx
        )
        if (!category) {
          throw createError({ statusCode: 409, message: 'Select an existing category', data: { field: 'categoryId' } })
        }
      }
      if (data.planning.enabled) {
        const members = await rows<{ user_id: string }>(
          'SELECT user_id FROM public.member WHERE organization_id=$1 AND user_id=ANY($2::text[])',
          [storeId, data.planning.providerUserIds],
          tx
        )
        if (data.planning.providerUserIds.some((userId) => !members.some((m) => m.user_id === userId))) {
          throw createError({
            statusCode: 400,
            message: 'Planning providers must belong to the store organization',
            data: { field: 'planning.providerUserIds' }
          })
        }
      }
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`product:${id}`])
      const [existing] = await rows<ProductRow>('SELECT * FROM products.product WHERE id=$1', [id], tx)
      if (
        existing &&
        (await tx.query('SELECT 1 FROM products.product WHERE id=$1 AND store_id=$2', [id, storeId])).rowCount !== 1
      ) {
        throw createError({ statusCode: 404, message: 'Product not found' })
      }
      if (data.visibility === 'unlisted') {
        data.slug = existing?.data.visibility === 'unlisted' ? existing.data.slug : randomBytes(24).toString('hex')
      }
      if (existing?.data.isFree && !data.isFree) {
        for (const currency of currentStore!.currencies) {
          if (!prices.some((price) => price.currency === currency)) {
            prices.push({ currency, amount: 0, taxBehavior: 'inclusive' })
          }
        }
      }
      for (const [visibility, ids] of [
        ['public', data.imageIds],
        ['private', data.fileIds]
      ] as const) {
        if (!ids.length) {
          continue
        }
        const found = await rows<{ id: string }>(
          'SELECT id FROM products.asset WHERE product_id=$1 AND id=ANY($2::text[]) AND visibility=$3 AND ready',
          [id, ids, visibility],
          tx
        )
        if (found.length !== new Set(ids).size) {
          throw createError({
            statusCode: 400,
            message: 'Choose images from the media library or files uploaded to this product'
          })
        }
      }
      if (data.imageSelection === 'ordered') {
        const linked = await rows<{ id: string; media_id: string | null }>(
          'SELECT id,media_id FROM products.asset WHERE product_id=$1 AND id=ANY($2::text[])',
          [id, data.imageIds],
          tx
        )
        Object.assign(data, orderedProductImagePlacements(orderedProductImageIds(data.imageIds, linked)))
      }
      const invalidMedia = await rows(
        `SELECT a.id FROM products.asset a LEFT JOIN products.media m ON m.id=a.media_id AND m.store_id=$3
         LEFT JOIN products.media_variant v ON v.media_id=m.id AND v.store_id=m.store_id AND v.key=a.media_variant
         WHERE a.product_id=$1 AND a.id=ANY($2::text[]) AND a.media_id IS NOT NULL
         AND (m.id IS NULL OR (NOT m.visible AND NOT ($4::jsonb ? a.id)) OR ($5::boolean=false AND a.media_variant<>'image' AND (v.file_id IS NULL OR NOT EXISTS(SELECT 1 FROM products.store s, jsonb_array_elements(s.media_variants) preset WHERE s.organization_id=$3 AND preset->>'key'=a.media_variant))))`,
        [id, data.imageIds, storeId, JSON.stringify(existing?.data.imageIds || []), data.imageSelection === 'ordered'],
        tx
      )
      if (invalidMedia.length) {
        throw createError({ statusCode: 400, message: 'A selected library image or variant is unavailable' })
      }
      for (const price of prices) {
        price.taxBehavior = currentStore!.currency_tax_behavior[price.currency] || 'inclusive'
      }
      await validateOutstandingOffers(id, { isFree: data.isFree, prices }, currentStore!.currencies, tx)
      await tx.query(
        'INSERT INTO products.product(id,store_id,slug,data,category_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET slug=$3,data=$4,category_id=$5,updated_at=now()',
        [id, storeId, data.slug, data, categoryId]
      )
      const active = await rows<Price>(
        'SELECT id,currency,amount,tax_behavior AS "taxBehavior" FROM products.price WHERE product_id=$1 AND active AND offer_id IS NULL',
        [id],
        tx
      )
      for (const old of active) {
        if (
          !prices.some(
            (p) => p.currency === old.currency && p.amount === old.amount && p.taxBehavior === old.taxBehavior
          )
        ) {
          await tx.query('UPDATE products.price SET active=false WHERE id=$1', [old.id])
        }
      }
      for (const price of prices) {
        if (
          !active.some(
            (p) => p.currency === price.currency && p.amount === price.amount && p.taxBehavior === price.taxBehavior
          )
        ) {
          await tx.query(
            'INSERT INTO products.price(id,product_id,currency,amount,tax_behavior) VALUES($1,$2,$3,$4,$5)',
            [randomUUID(), id, price.currency, price.amount, price.taxBehavior]
          )
        }
      }
    })
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      throw createError({ statusCode: 409, message: 'This product slug already exists', data: { field: 'slug' } })
    }
    throw error
  }
  return getProduct(storeId, id)
}
export async function deletion(storeId: string, id: string) {
  await getProduct(storeId, id)
  const [r] = await rows<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM products.order_line WHERE product_id=$1) AS exists',
    [id]
  )
  return { eligible: !r!.exists }
}
export async function deleteProduct(storeId: string, id: string, name: string) {
  await transaction(async (tx) => {
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`product:${id}`])
    const product = await getProduct(storeId, id)
    if (name !== product.content.en.title && name !== product.content.nl.title) {
      throw createError({ statusCode: 400, message: 'Product name does not match' })
    }
    if (!(await deletion(storeId, id)).eligible) {
      throw createError({ statusCode: 409, message: 'Archive products with order history' })
    }
    await tx.query('DELETE FROM products.price WHERE product_id=$1', [id])
    await tx.query('DELETE FROM products.product WHERE id=$1 AND store_id=$2', [id, storeId])
  })
}
export async function getEffectiveProduct(storeId: string, id: string, at = new Date(), tx?: PoolClient) {
  return effectivePricing(await getProduct(storeId, id, false, tx), at)
}
export async function publicProduct(
  regularProduct: Product,
  locale: Locale,
  currency?: string,
  at = new Date()
): Promise<CatalogProduct> {
  const product = effectivePricing(regularProduct, at)
  const store = await getStore()
  locale = store.languages.includes(locale) ? locale : store.default_locale
  const copy = selectCopy(product, locale, store.default_locale)
  const [category] = product.categoryId
    ? await rows<{ code: string; content: Record<Locale, { name: string; description: string }> }>(
        'SELECT code,content FROM products.category WHERE store_id=$1 AND id=$2',
        [store.organization_id, product.categoryId]
      )
    : []
  const categoryCopy = category?.content[locale].name
    ? category.content[locale]
    : category?.content[store.default_locale]
  const imageAssets = product.imageIds.length
    ? await rows<{ id: string; object_key: string; media_id: string | null }>(
        "SELECT id,object_key,media_id FROM products.asset WHERE ready AND visibility='public' AND id=ANY($1::text[])",
        [product.imageIds]
      )
    : []
  const imageKeys = new Map(imageAssets.filter((asset) => !asset.media_id).map((asset) => [asset.id, asset.object_key]))
  const imageKitEndpoint = process.env.PRODUCTS_IMAGEKIT_URL_ENDPOINT?.replace(/\/$/, '')
  const imageUrls = new Map(
    await Promise.all(
      product.imageIds.map(async (id) => {
        if (imageKitEndpoint && imageKeys.get(id)) {
          return [id, `${imageKitEndpoint}/${imageKeys.get(id)}`] as const
        }
        const url = await assetUrl(id)
        return [id, url.startsWith('/') ? `${baseUrl()}${url}` : url] as const
      })
    )
  )
  const linkedImages = new Set(imageAssets.filter((asset) => asset.media_id).map((asset) => asset.id))
  const imageUrl = (id: string, purpose: 'thumbnail' | 'gallery' | 'detail') => {
    const url = imageUrls.get(id) || `${baseUrl()}/api/store/media/${id}`
    return product.imageSelection === 'ordered' && linkedImages.has(id)
      ? `${url}${url.includes('?') ? '&' : '?'}purpose=${purpose}`
      : url
  }
  return {
    thankYou: await productThankYouCopies(store.organization_id, product.slug, locale),
    storeMode: store.mode,
    visibility: product.visibility || 'listed',
    paymentMethods: [
      ...(store.online_payment !== false ? ['online'] : []),
      ...(store.invoice_payment ? ['invoice'] : [])
    ],
    categoryDetails: category && categoryCopy ? { code: category.code, ...categoryCopy } : undefined,
    isFree: product.isFree || (!!currency && product.prices.find((p) => p.currency === currency)?.amount === 0),
    pricingComplete: !!hasRequiredPrices(regularProduct, store.currencies),
    id: product.id,
    slug: product.slug,
    type: product.type,
    categoryId: product.categoryId,
    category: category?.code || '',
    title: copy.title,
    subtitle: copy.subtitle || '',
    buyButtonLabel: copy.buyButtonLabel || '',
    secondaryCta: copy.secondaryCta || '',
    summary: copy.summary,
    nextSteps: product.nextSteps[locale] || product.nextSteps[store.default_locale] || '',
    summaryHtml: renderDescription(copy.summary),
    markdownStyle: markdownStyleSchema.parse(store.markdown_style || {}),
    imagePolicy: store.image_policy || {
      thumbnail: { width: 400, height: 400 },
      gallery: { width: 800, height: 1000 },
      detail: { width: 1200, height: 900 }
    },
    descriptionHtml: renderDescription(copy.description),
    images: product.galleryImageIds.map((id) => imageUrl(id, 'gallery')),
    thumbnailImage: product.thumbnailImageId ? imageUrl(product.thumbnailImageId, 'thumbnail') : null,
    detailImages: product.detailImageIds.map((id) => imageUrl(id, 'detail')),
    videoUrl: product.videoUrl,
    prices: product.prices.filter(
      (p) =>
        (regularProduct.isFree && !p.offer) ||
        (store.currencies.includes(p.currency) && (!currency || p.currency === currency))
    ),
    planningEnabled: !!product.planning?.enabled,
    durationMinutes: product.planning?.durationMinutes ?? null,
    purchaseUrl: `${baseUrl()}/store/${product.slug}${product.planning?.enabled ? '/book' : ''}`,
    locale,
    checkoutAppearance: await purchaseAppearance(store.organization_id, store.checkout_appearance)
  } as CatalogProduct
}
export type ProductInput = z.infer<typeof productSchema>
