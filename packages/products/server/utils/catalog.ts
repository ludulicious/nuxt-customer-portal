import { parseInput } from '@nuxt-customer-portal/products/server/utils/validation'
import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'
import type { z } from 'zod'
import type { Product, ProductData, Price, Locale, CatalogProduct, Page } from '../../shared/types'
import { productSchema, listSchema } from '../../shared/validation'
import { rows, transaction } from './database'
import { baseUrl, getStore } from './access'

interface ProductRow {
  id: string
  data: ProductData
  updated_at: string
}
export const renderDescription = (source: string) =>
  sanitizeHtml(marked.parse(source, { async: false }), {
    allowedTags: [
      'p',
      'br',
      'strong',
      'em',
      'h2',
      'h3',
      'h4',
      'ul',
      'ol',
      'li',
      'blockquote',
      'a',
      'hr',
      'code',
      'pre'
    ],
    allowedAttributes: { a: ['href', 'title'] },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowProtocolRelative: false
  })
export const selectCopy = (data: ProductData, locale: Locale, fallback: Locale) =>
  data.content[locale].title
    ? data.content[locale]
    : data.content[fallback].title
      ? data.content[fallback]
      : data.content[locale === 'en' ? 'nl' : 'en']
export async function getProduct(storeId: string, id: string, bySlug = false): Promise<Product> {
  const [row] = await rows<ProductRow>(
    `SELECT * FROM products.product WHERE store_id=$1 AND ${bySlug ? 'slug' : 'id'}=$2`,
    [storeId, id]
  )
  if (!row) {
    throw createError({ statusCode: 404, message: 'Product not found' })
  }
  const prices = await rows<Price>(
    'SELECT id,currency,amount,tax_behavior AS "taxBehavior" FROM products.price WHERE product_id=$1 AND active ORDER BY currency',
    [row.id]
  )
  return { ...row.data, id: row.id, prices, updatedAt: row.updated_at }
}
export async function listProducts(storeId: string, input: unknown, published = false): Promise<Page<Product>> {
  const q = parseInput(listSchema, input),
    params: unknown[] = [storeId],
    conditions = ['store_id=$1']
  const add = (sql: string, value: unknown) => {
    params.push(value)
    conditions.push(sql.replace('?', `$${params.length}`))
  }
  if (published) {
    add("data->>'status'=?", 'published')
  } else if (q.status) {
    add("data->>'status'=?", q.status)
  }
  if (q.type) {
    add("data->>'type'=?", q.type)
  }
  if (q.category) {
    add("data->>'category'=?", q.category)
  }
  if (q.search) {
    add("concat_ws(' ',data->'content'->'en'->>'title',data->'content'->'nl'->>'title',slug) ILIKE ?", `%${q.search}%`)
  }
  if (q.currency) {
    add(
      'EXISTS(SELECT 1 FROM products.price pr WHERE pr.product_id=products.product.id AND pr.active AND pr.currency=?)',
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
export async function saveProduct(storeId: string, input: unknown, id: string = randomUUID()): Promise<Product> {
  const { prices, ...data } = parseInput(productSchema, input)
  const store = await getStore()
  if (store.organization_id !== storeId) {
    throw createError({ statusCode: 403, message: 'Store access denied' })
  }
  if (data.status === 'published' && !data.content[store.default_locale].title) {
    throw createError({ statusCode: 400, message: 'A title in the store default language is required' })
  }
  try {
    await transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`product:${id}`])
      const [existing] = await rows<ProductRow>('SELECT * FROM products.product WHERE id=$1', [id], tx)
      if (
        existing &&
        (await tx.query('SELECT 1 FROM products.product WHERE id=$1 AND store_id=$2', [id, storeId])).rowCount !== 1
      ) {
        throw createError({ statusCode: 404, message: 'Product not found' })
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
          throw createError({ statusCode: 400, message: 'Media must be uploaded to this product first' })
        }
      }
      await tx.query(
        'INSERT INTO products.product(id,store_id,slug,data) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET slug=$3,data=$4,updated_at=now()',
        [id, storeId, data.slug, data]
      )
      const active = await rows<Price>(
        'SELECT id,currency,amount,tax_behavior AS "taxBehavior" FROM products.price WHERE product_id=$1 AND active',
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
    'SELECT EXISTS(SELECT 1 FROM products.purchase WHERE product_id=$1) AS exists',
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
export async function publicProduct(product: Product, locale: Locale, currency?: string): Promise<CatalogProduct> {
  const store = await getStore()
  const copy = selectCopy(product, locale, store.default_locale)
  return {
    id: product.id,
    slug: product.slug,
    type: product.type,
    category: product.category,
    title: copy.title,
    summary: copy.summary,
    descriptionHtml: renderDescription(copy.description),
    images: product.imageIds.map((id) => `${baseUrl()}/api/store/media/${id}`),
    videoUrl: product.videoUrl,
    prices: product.prices.filter((p) => !currency || p.currency === currency),
    purchaseUrl: `${baseUrl()}/store/${product.slug}`,
    locale
  } as CatalogProduct
}
export type ProductInput = z.infer<typeof productSchema>
