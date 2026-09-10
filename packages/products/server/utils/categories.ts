import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import { categorySchema } from '../../shared/validation'
import type { ProductCategory } from '../../shared/types'
import { parseInput } from './validation'
import { rows, transaction } from './database'

export const listCategories = (storeId: string) =>
  rows<ProductCategory>(
    `SELECT c.id,c.name,(SELECT count(*)::int FROM products.product p WHERE p.store_id=c.store_id AND p.data->>'category'=c.name) AS "productCount" FROM products.category c WHERE c.store_id=$1 ORDER BY lower(c.name),c.id`,
    [storeId]
  )
export async function saveCategory(storeId: string, input: unknown, id?: string) {
  const { name } = parseInput(categorySchema, input)
  return transaction(async (tx) => {
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`categories:${storeId}`])
    const [existing] = id
      ? await rows<{ name: string }>(
          'SELECT name FROM products.category WHERE store_id=$1 AND id=$2',
          [storeId, id],
          tx
        )
      : []
    if (id && !existing) {
      throw createError({ statusCode: 404, message: 'Category not found' })
    }
    const duplicate = await rows(
      'SELECT id FROM products.category WHERE store_id=$1 AND lower(name)=lower($2) AND id<>$3',
      [storeId, name, id || ''],
      tx
    )
    if (duplicate.length) {
      throw createError({ statusCode: 409, message: 'Category already exists' })
    }
    const categoryId = id || randomUUID()
    await tx.query(
      'INSERT INTO products.category(id,store_id,name) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET name=$3',
      [categoryId, storeId, name]
    )
    if (existing && existing.name !== name) {
      await tx.query(
        "UPDATE products.product SET data=jsonb_set(data,'{category}',to_jsonb($3::text)),updated_at=now() WHERE store_id=$1 AND data->>'category'=$2",
        [storeId, existing.name, name]
      )
    }
    return { id: categoryId, name }
  })
}
export async function deleteCategory(storeId: string, id: string, input: unknown) {
  const { name } = parseInput(categorySchema, input)
  await transaction(async (tx) => {
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`categories:${storeId}`])
    const [existing] = await rows<{ name: string }>(
      'SELECT name FROM products.category WHERE store_id=$1 AND id=$2',
      [storeId, id],
      tx
    )
    if (!existing) {
      throw createError({ statusCode: 404, message: 'Category not found' })
    }
    if (name !== existing.name) {
      throw createError({ statusCode: 400, message: 'Category name does not match' })
    }
    if (
      (
        await rows(
          "SELECT id FROM products.product WHERE store_id=$1 AND data->>'category'=$2 LIMIT 1",
          [storeId, name],
          tx
        )
      ).length
    ) {
      throw createError({ statusCode: 409, message: 'Category is used by products' })
    }
    await tx.query('DELETE FROM products.category WHERE store_id=$1 AND id=$2', [storeId, id])
  })
}
