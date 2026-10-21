import { rows } from './database'
import { parseInput } from './validation'
import { renderDescription } from './markdown'
import {
  pageTextTargetSchema,
  savePageTextSchema,
  resolveProductOrderPageCopy,
  defaultOrderPageCopy,
  type PageText
} from '../../shared/page-texts'

export function pageTexts(storeId: string): Promise<PageText[]> {
  return rows<PageText>(
    'SELECT page,locale,product_slug AS "productSlug",copy FROM products.page_text WHERE store_id=$1 ORDER BY product_slug,page,locale',
    [storeId]
  )
}
export async function orderPageCopy(storeId: string, locale: 'en' | 'nl', productSlug = '') {
  const entries = await pageTexts(storeId)
  const copy = resolveProductOrderPageCopy(entries, productSlug, locale)
  return { ...copy, contentHtml: renderDescription(copy.content) }
}
export async function savePageText(storeId: string, input: unknown) {
  const entry = parseInput(savePageTextSchema, input)
  const defaults = defaultOrderPageCopy(entry.locale)
  const copy = Object.fromEntries(
    Object.entries(entry.copy).filter(
      ([key, value]) =>
        value?.trim() && (entry.productSlug || value.trim() !== defaults[key as keyof typeof entry.copy])
    )
  )
  await rows(
    'INSERT INTO products.page_text(store_id,page,locale,product_slug,copy) VALUES($1,$2,$3,$4,$5) ON CONFLICT(store_id,page,locale,product_slug) DO UPDATE SET copy=$5,updated_at=now()',
    [storeId, entry.page, entry.locale, entry.productSlug, copy]
  )
  return { ...entry, copy }
}
export async function resetPageText(storeId: string, input: unknown) {
  const target = parseInput(pageTextTargetSchema, input)
  await rows('DELETE FROM products.page_text WHERE store_id=$1 AND page=$2 AND locale=$3 AND product_slug=$4', [
    storeId,
    target.page,
    target.locale,
    target.productSlug
  ])
}
