import { rows } from './database'
import { parseInput } from './validation'
import { renderDescription } from './markdown'
import {
  pageTextTargetSchema,
  savePageTextSchema,
  resolveOrderPageCopy,
  defaultOrderPageCopy,
  type PageText
} from '../../shared/page-texts'

export function pageTexts(storeId: string): Promise<PageText[]> {
  return rows<PageText>('SELECT page,locale,copy FROM products.page_text WHERE store_id=$1 ORDER BY page,locale', [
    storeId
  ])
}
export async function orderPageCopy(storeId: string, locale: 'en' | 'nl') {
  const [entry] = await rows<PageText>(
    "SELECT page,locale,copy FROM products.page_text WHERE store_id=$1 AND page='order-details' AND locale=$2",
    [storeId, locale]
  )
  const copy = resolveOrderPageCopy(entry?.copy, locale)
  return { ...copy, contentHtml: renderDescription(copy.content) }
}
export async function savePageText(storeId: string, input: unknown) {
  const entry = parseInput(savePageTextSchema, input)
  const defaults = defaultOrderPageCopy(entry.locale)
  const copy = Object.fromEntries(
    Object.entries(entry.copy).filter(
      ([key, value]) => value?.trim() && value.trim() !== defaults[key as keyof typeof entry.copy]
    )
  )
  await rows(
    'INSERT INTO products.page_text(store_id,page,locale,copy) VALUES($1,$2,$3,$4) ON CONFLICT(store_id,page,locale) DO UPDATE SET copy=$4,updated_at=now()',
    [storeId, entry.page, entry.locale, copy]
  )
  return { ...entry, copy }
}
export async function resetPageText(storeId: string, input: unknown) {
  const target = parseInput(pageTextTargetSchema, input)
  await rows('DELETE FROM products.page_text WHERE store_id=$1 AND page=$2 AND locale=$3', [
    storeId,
    target.page,
    target.locale
  ])
}
