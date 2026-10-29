import { checkoutAppearanceSchema, type CheckoutAppearance } from '../../shared/checkout-appearance'
import type { ProductData } from '../../shared/types'
import { baseUrl } from './access'
import { rows } from './database'

export async function purchaseAppearance(storeId: string, appearance?: CheckoutAppearance) {
  const [provider] = await rows<{ name: string; logo: string | null }>(
    'SELECT name,logo FROM public.organization WHERE id=$1',
    [storeId]
  )
  const configured = checkoutAppearanceSchema.parse(appearance || {})
  let portalLogo = ''
  if (!configured.logoUrl) {
    // Products also runs without the optional SaaS configuration layer.
    const [table] = await rows<{ name: string | null }>(
      "SELECT to_regclass('saas_configuration.portal_settings') AS name"
    )
    if (table?.name) {
      const [branding] = await rows<{ logo_light: string | null; logo_dark: string | null }>(
        `SELECT settings->'branding'->>'logoLight' AS logo_light,
                settings->'branding'->>'logoDark' AS logo_dark
         FROM saas_configuration.portal_settings WHERE id=true`
      )
      portalLogo = branding?.logo_light || branding?.logo_dark || ''
    }
  }
  return {
    ...configured,
    hostName: configured.hostName || provider?.name || '',
    // Organization uploads are stored as data URLs as well as hosted image URLs.
    logoUrl: configured.logoUrl || portalLogo || provider?.logo || ''
  }
}

export async function purchaseThumbnail(product: ProductData, storeId: string): Promise<string | null> {
  const id = product.thumbnailImageId || (product.thumbnailImageId === undefined ? product.imageIds?.[0] : undefined)
  if (!id || !product.imageIds?.includes(id)) {
    return null
  }
  const [asset] = await rows<{ object_key: string; media_id: string | null }>(
    `SELECT a.object_key,a.media_id FROM products.asset a JOIN products.product p ON p.id=a.product_id
     WHERE a.id=$1 AND p.store_id=$2 AND a.ready AND a.visibility='public'`,
    [id, storeId]
  )
  if (!asset) {
    return null
  }
  const endpoint = process.env.PRODUCTS_IMAGEKIT_URL_ENDPOINT?.replace(/\/$/, '')
  return endpoint && !asset.media_id
    ? `${endpoint}/${asset.object_key}`
    : `${baseUrl()}/api/store/media/${encodeURIComponent(id)}${product.imageSelection === 'ordered' && asset.media_id ? '?purpose=thumbnail' : ''}`
}
