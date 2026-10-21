import { renderDescription } from './markdown'
import { rows } from './database'
import { resolveThankYouCopy, type ThankYouText } from '../../shared/thank-you'

export async function thankYouTexts(storeId: string, locale?: 'en' | 'nl', slug?: string): Promise<ThankYouText[]> {
  return rows<ThankYouText>(
    `SELECT product_slug AS "productSlug", locale, variant, copy FROM products.thank_you_text WHERE store_id=$1${locale ? " AND locale=$2 AND product_slug IN ('',$3)" : ''} ORDER BY product_slug,locale,variant`,
    locale ? [storeId, locale, slug || ''] : [storeId]
  )
}
export async function productThankYouCopies(storeId: string, slug: string, locale: 'en' | 'nl') {
  const entries = await thankYouTexts(storeId, locale, slug)
  const free = resolveThankYouCopy(entries, slug, 'free', locale)
  const paid = resolveThankYouCopy(entries, slug, 'paid', locale)
  return {
    free: { ...free, contentHtml: renderDescription(free.content!) },
    paid: { ...paid, contentHtml: renderDescription(paid.content!) }
  }
}

export async function saveThankYouText(storeId: string, input: ThankYouText) {
  const copy = Object.fromEntries(Object.entries(input.copy).filter(([, value]) => value?.trim()))
  await rows(
    `INSERT INTO products.thank_you_text(store_id,product_slug,locale,variant,copy) VALUES($1,$2,$3,$4,$5) ON CONFLICT(store_id,product_slug,locale,variant) DO UPDATE SET copy=$5,updated_at=now()`,
    [storeId, input.productSlug, input.locale, input.variant, copy]
  )
  return { ...input, copy }
}
export async function resetThankYouText(storeId: string, target: Omit<ThankYouText, 'copy'>) {
  await rows('DELETE FROM products.thank_you_text WHERE store_id=$1 AND product_slug=$2 AND locale=$3 AND variant=$4', [
    storeId,
    target.productSlug,
    target.locale,
    target.variant
  ])
}
