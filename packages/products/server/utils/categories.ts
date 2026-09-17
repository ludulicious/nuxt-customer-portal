import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import { categorySchema, categoryDeleteSchema, categoryListSchema } from '../../shared/validation'
import type { ProductCategory, Page } from '../../shared/types'
import { parseInput } from './validation'
import { rows, transaction } from './database'

const projection = `c.id,c.code,c.name,c.content,(SELECT count(*)::int FROM products.product p WHERE p.store_id=c.store_id AND p.category_id=c.id) AS "productCount"`
export const listCategories = (storeId: string) =>
  rows<ProductCategory>(
    `SELECT ${projection} FROM products.category c WHERE c.store_id=$1 ORDER BY lower(c.name),c.id`,
    [storeId]
  )
export async function categoryPage(storeId: string, input: unknown): Promise<Page<ProductCategory>> {
  const q = parseInput(categoryListSchema, input)
  const params = [storeId, `%${q.search}%`]
  const where = `c.store_id=$1 AND concat_ws(' ',c.code,c.content->'en'->>'name',c.content->'nl'->>'name',c.content->'en'->>'description',c.content->'nl'->>'description') ILIKE $2`
  const [count] = await rows<{ count: number }>(
    `SELECT count(*)::int AS count FROM products.category c WHERE ${where}`,
    params
  )
  const sort = q.sortBy === 'code' ? 'c.code' : `coalesce(nullif(c.content->'${q.locale}'->>'name',''),c.name)`
  const items = await rows<ProductCategory>(
    `SELECT ${projection} FROM products.category c WHERE ${where} ORDER BY lower(${sort}) ${q.sortDir === 'desc' ? 'DESC' : 'ASC'},c.id LIMIT 20 OFFSET $3`,
    [...params, (q.page - 1) * 20]
  )
  return {
    items,
    pagination: { page: q.page, pageSize: 20, totalItems: count!.count, totalPages: Math.ceil(count!.count / 20) }
  }
}
export async function saveCategory(storeId: string, input: unknown, id?: string): Promise<ProductCategory> {
  const { code, content } = parseInput(categorySchema, input)
  return transaction(async (tx) => {
    const [store] = await rows<{ languages: ('en' | 'nl')[]; default_locale: 'en' | 'nl' }>(
      'SELECT languages,default_locale FROM products.store WHERE organization_id=$1 FOR SHARE',
      [storeId],
      tx
    )
    if (!store) {
      throw createError({ statusCode: id ? 404 : 403, message: id ? 'Category not found' : 'Store access denied' })
    }
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`categories:${storeId}`])
    const [existing] = id
      ? await rows<ProductCategory>(
          `SELECT ${projection} FROM products.category c WHERE c.store_id=$1 AND c.id=$2`,
          [storeId, id],
          tx
        )
      : []
    if (id && !existing) {
      throw createError({ statusCode: 404, message: 'Category not found' })
    }
    for (const language of [store.default_locale]) {
      if (!content[language].name) {
        throw createError({
          statusCode: 400,
          message: 'Enter a name in the default store language',
          data: { field: `content.${language}.name` }
        })
      }
    }
    const duplicate = await rows(
      'SELECT id FROM products.category WHERE store_id=$1 AND lower(code)=lower($2) AND id<>$3',
      [storeId, code, id || ''],
      tx
    )
    if (duplicate.length) {
      throw createError({ statusCode: 409, message: 'Category code already exists', data: { field: 'code' } })
    }
    const categoryId = id || randomUUID()
    const name = content[store.default_locale].name
    await tx.query(
      'INSERT INTO products.category(id,store_id,code,name,content) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET code=$3,name=$4,content=$5',
      [categoryId, storeId, code, name, content]
    )
    return { id: categoryId, code, name, content, productCount: existing?.productCount || 0 }
  })
}
export async function categoryDeletion(storeId: string, id: string) {
  const [category] = await rows<ProductCategory>(
    `SELECT ${projection} FROM products.category c WHERE c.store_id=$1 AND c.id=$2`,
    [storeId, id]
  )
  if (!category) {
    throw createError({ statusCode: 404, message: 'Category not found' })
  }
  return { eligible: category.productCount === 0 }
}
export async function deleteCategory(storeId: string, id: string, input: unknown) {
  const { name } = parseInput(categoryDeleteSchema, input)
  await transaction(async (tx) => {
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`categories:${storeId}`])
    const [existing] = await rows<ProductCategory>(
      `SELECT ${projection} FROM products.category c WHERE c.store_id=$1 AND c.id=$2`,
      [storeId, id],
      tx
    )
    if (!existing) {
      throw createError({ statusCode: 404, message: 'Category not found' })
    }
    if (![existing.name, ...Object.values(existing.content).map((copy) => copy.name)].includes(name)) {
      throw createError({ statusCode: 400, message: 'Category name does not match' })
    }
    if (existing.productCount) {
      throw createError({ statusCode: 409, message: 'Category is used by products' })
    }
    await tx.query('DELETE FROM products.category WHERE store_id=$1 AND id=$2', [storeId, id])
  })
}
