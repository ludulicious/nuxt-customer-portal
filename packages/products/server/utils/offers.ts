import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import type { PoolClient } from 'pg'
import type { Price, Product, ProductOffer } from '../../shared/types'
import { offerSchema, offerPricesValid, periodsOverlap } from '../../shared/offers'
import { rows, transaction } from './database'
import { parseInput } from './validation'

export async function productOffers(productId: string, tx?: PoolClient): Promise<ProductOffer[]> {
  const offers = await rows<ProductOffer>(
    'SELECT id,starts_at AS "startsAt",ends_at AS "endsAt",enabled,is_free AS "isFree" FROM products.offer WHERE product_id=$1 ORDER BY starts_at,id',
    [productId],
    tx
  )
  const prices = await rows<Price & { offerId: string }>(
    'SELECT id,currency,amount,tax_behavior AS "taxBehavior",offer_id AS "offerId" FROM products.price WHERE product_id=$1 AND active AND offer_id IS NOT NULL ORDER BY currency',
    [productId],
    tx
  )
  return offers.map((offer) => ({
    ...offer,
    startsAt: new Date(offer.startsAt).toISOString(),
    endsAt: new Date(offer.endsAt).toISOString(),
    prices: prices.filter((p) => p.offerId === offer.id).map(({ offerId: _offerId, ...p }) => p)
  }))
}
export async function validateOutstandingOffers(
  productId: string,
  regular: { isFree?: boolean; prices: { currency: string; amount: number }[] },
  currencies: string[],
  tx: PoolClient
) {
  const at = Date.now()
  for (const offer of await productOffers(productId, tx)) {
    if (offer.enabled && Date.parse(offer.endsAt) > at && !offerPricesValid(offer, regular, currencies)) {
      throw createError({
        statusCode: 409,
        message: 'Update or cancel outstanding offers before changing regular prices or store currencies'
      })
    }
  }
}
export async function saveOffer(storeId: string, productId: string, input: unknown, offerId?: string) {
  const data = parseInput(offerSchema, input)
  const id = offerId || randomUUID()
  await transaction(async (tx) => {
    const [store] = await rows<{ currencies: string[]; tax: Record<string, 'inclusive' | 'exclusive'> }>(
      'SELECT currencies,currency_tax_behavior AS tax FROM products.store WHERE organization_id=$1 FOR SHARE',
      [storeId],
      tx
    )
    if (!store) {
      throw createError({ statusCode: 404, message: 'Store not found' })
    }
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`product:${productId}`])
    const [product] = await rows<{ data: Product }>(
      'SELECT data FROM products.product WHERE id=$1 AND store_id=$2 FOR UPDATE',
      [productId, storeId],
      tx
    )
    if (!product) {
      throw createError({ statusCode: 404, message: 'Product not found' })
    }
    const offers = await productOffers(productId, tx)
    const existing = offers.find((o) => o.id === offerId)
    if (offerId && (!existing || !existing.enabled || Date.parse(existing.endsAt) <= Date.now())) {
      throw createError({ statusCode: 409, message: 'Only active or scheduled offers can be edited' })
    }
    if (Date.parse(data.endsAt) <= Date.now()) {
      throw createError({ statusCode: 400, message: 'Offer end must be in the future', data: { field: 'endsAt' } })
    }
    if (offers.some((o) => o.id !== id && o.enabled && periodsOverlap(o, data))) {
      throw createError({ statusCode: 409, message: 'Offer periods cannot overlap', data: { field: 'startsAt' } })
    }
    const regular = await rows<Price>(
      'SELECT id,currency,amount,tax_behavior AS "taxBehavior" FROM products.price WHERE product_id=$1 AND active AND offer_id IS NULL',
      [productId],
      tx
    )
    const prices = data.isFree
      ? store.currencies.map((currency) => ({
          currency,
          amount: 0,
          taxBehavior: store.tax[currency] || ('inclusive' as const)
        }))
      : data.prices
    if (!offerPricesValid({ ...data, prices }, { ...product.data, prices: regular }, store.currencies)) {
      throw createError({
        statusCode: 400,
        message: 'Set a lower offer price for every store currency',
        data: { field: 'prices' }
      })
    }
    await tx.query(
      'INSERT INTO products.offer(id,product_id,starts_at,ends_at,is_free) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET starts_at=$3,ends_at=$4,is_free=$5',
      [id, productId, data.startsAt, data.endsAt, data.isFree]
    )
    // New IDs invalidate quotes when an offer is edited; old order references remain intact.
    await tx.query('UPDATE products.price SET active=false WHERE offer_id=$1 AND active', [id])
    for (const price of prices) {
      await tx.query(
        'INSERT INTO products.price(id,product_id,offer_id,currency,amount,tax_behavior) VALUES($1,$2,$3,$4,$5,$6)',
        [randomUUID(), productId, id, price.currency, price.amount, store.tax[price.currency] || 'inclusive']
      )
    }
    await tx.query('UPDATE products.product SET updated_at=now() WHERE id=$1', [productId])
  })
  return (await productOffers(productId)).find((o) => o.id === id)!
}
export async function cancelOffer(storeId: string, productId: string, offerId: string) {
  await transaction(async (tx) => {
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`product:${productId}`])
    const result = await tx.query(
      'UPDATE products.offer o SET enabled=false FROM products.product p WHERE o.id=$1 AND o.product_id=$2 AND p.id=o.product_id AND p.store_id=$3 RETURNING o.id',
      [offerId, productId, storeId]
    )
    if (!result.rowCount) {
      throw createError({ statusCode: 404, message: 'Offer not found' })
    }
    await tx.query('UPDATE products.product SET updated_at=now() WHERE id=$1', [productId])
  })
  return { success: true }
}
