import type { ProductMediaSelection } from '../../shared/product-media'
import type { PublicOrderDetails } from '../../shared/public-order'
import type { AdminOrderDetails } from '../../shared/admin-order'
import type { PageText } from '../../shared/page-texts'
import type { ThankYouText } from '../../shared/thank-you'
import type { OfferInput } from '../../shared/offers'
import type {
  ProductOffer,
  Product,
  Page,
  Asset,
  CatalogProduct,
  Order,
  ProductCategory,
  ProductPreview,
  ImagePolicy,
  ImagePurpose,
  StorageSettings,
  StripeSettings,
  CheckoutAppearance,
  Purchase
} from '../../shared/types'
import type { MarkdownStyle } from '../../shared/markdown-style'
import type { z } from 'zod'
import type { productSchema, categorySchema } from '../../shared/validation'

type ProductInput = z.input<typeof productSchema>
export const useProducts = () => ({
  previewOrderPage: (slug: string, locale: 'en' | 'nl') =>
    $fetch<PublicOrderDetails, string>('/api/products/admin/page-texts/preview', { query: { slug, locale } }),
  pageTexts: () => $fetch<PageText[], string>('/api/products/admin/page-texts'),
  savePageText: (body: PageText) => $fetch<PageText, string>('/api/products/admin/page-texts', { method: 'PUT', body }),
  resetPageText: (body: Omit<PageText, 'copy'>) =>
    $fetch<unknown, string>('/api/products/admin/page-texts', { method: 'DELETE', body }),
  renderStoreText: (content: string, signal?: AbortSignal) =>
    $fetch<{ html: string }, string>('/api/products/admin/page-texts/render', {
      method: 'POST',
      body: { content },
      signal
    }),
  renderThankYou: (content: string, signal?: AbortSignal) =>
    $fetch<{ html: string }, string>('/api/products/admin/thank-you/render', {
      method: 'POST',
      body: { content },
      signal
    }),
  thankYouTexts: () => $fetch<ThankYouText[], string>('/api/products/admin/thank-you'),
  saveThankYouText: (body: ThankYouText) =>
    $fetch<ThankYouText, string>('/api/products/admin/thank-you', { method: 'PUT', body }),
  resetThankYouText: (body: Omit<ThankYouText, 'copy'>) =>
    $fetch<unknown, string>('/api/products/admin/thank-you', { method: 'DELETE', body }),
  previewThankYou: (slug: string, locale: string) =>
    $fetch<CatalogProduct, string>('/api/products/admin/thank-you/preview', { query: { slug, locale } }),
  preview: (id: string) =>
    $fetch<ProductPreview, string>(`/api/products/admin/products/${encodeURIComponent(id)}/preview`),
  previewImageUrl: (id: string, assetId: string, purpose?: ImagePurpose) =>
    `/api/products/admin/products/${encodeURIComponent(id)}/images/${encodeURIComponent(assetId)}${purpose ? '?purpose=' + purpose : ''}`,

  categories: () => $fetch<ProductCategory[], string>('/api/products/admin/categories'),
  categoryPage: (query: Record<string, unknown>, signal?: AbortSignal) =>
    $fetch<Page<ProductCategory>, string>('/api/products/admin/categories/list', { query, signal }),
  categoryDeletion: (id: string) =>
    $fetch<{ eligible: boolean }, string>(`/api/products/admin/categories/${id}/deletion`),
  saveCategory: (body: z.infer<typeof categorySchema>, id?: string) =>
    $fetch<ProductCategory, string>(id ? `/api/products/admin/categories/${id}` : '/api/products/admin/categories', {
      method: id ? 'PUT' : 'POST',
      body
    }),
  deleteCategory: (id: string, name: string) =>
    $fetch<unknown, string>(`/api/products/admin/categories/${id}`, { method: 'DELETE', body: { name } }),
  checkoutClients: () => $fetch<Array<{ id: string; name: string }>, string>('/api/products/checkout-clients'),
  list: (query: Record<string, unknown>, signal?: AbortSignal) =>
    $fetch<Page<Product>, string>('/api/products/admin/products', { query, signal }),
  get: (id: string) => $fetch<Product, string>(`/api/products/admin/products/${encodeURIComponent(id)}`),
  save: (input: ProductInput, id?: string) =>
    $fetch<Product, string>(id ? `/api/products/admin/products/${id}` : '/api/products/admin/products', {
      method: id ? 'PUT' : 'POST',
      body: input
    }),
  saveOffer: (productId: string, body: OfferInput, offerId?: string) =>
    $fetch<ProductOffer, string>(
      `/api/products/admin/products/${encodeURIComponent(productId)}/offers${offerId ? `/${encodeURIComponent(offerId)}` : ''}`,
      { method: offerId ? 'PUT' : 'POST', body }
    ),
  cancelOffer: (productId: string, offerId: string) =>
    $fetch<unknown, string>(
      `/api/products/admin/products/${encodeURIComponent(productId)}/offers/${encodeURIComponent(offerId)}`,
      {
        method: 'DELETE'
      }
    ),
  saveLinks: (id: string, links: NonNullable<Product['links']>) =>
    $fetch<Product, string>(`/api/products/admin/products/${encodeURIComponent(id)}/links`, {
      method: 'PUT',
      body: { links }
    }),
  savePricing: (id: string, input: Pick<ProductInput, 'isFree' | 'prices'>) =>
    $fetch<Product, string>(`/api/products/admin/products/${encodeURIComponent(id)}/pricing`, {
      method: 'PUT',
      body: input
    }),
  saveContent: (id: string, input: Pick<ProductInput, 'content' | 'nextSteps'>) =>
    $fetch<Product, string>(`/api/products/admin/products/${encodeURIComponent(id)}/content`, {
      method: 'PUT',
      body: input
    }),
  deletion: (id: string) => $fetch<{ eligible: boolean }, string>(`/api/products/admin/products/${id}/deletion`),
  remove: (id: string, name: string) =>
    $fetch<unknown, string>(`/api/products/admin/products/${id}`, { method: 'DELETE', body: { name } }),
  linkMedia: (id: string, body: ProductMediaSelection) =>
    $fetch<Asset, string>(`/api/products/admin/products/${encodeURIComponent(id)}/media`, { method: 'POST', body }),
  assets: (id: string) => $fetch<Asset[], string>(`/api/products/admin/products/${id}/assets`),
  async upload(
    id: string,
    file: File,
    visibility: 'public' | 'private',
    crop?: { x: number; y: number; width: number; height: number },
    purpose?: ImagePurpose
  ) {
    const signed = await $fetch<
      { id: string; url: string; fields: Record<string, string>; method: 'POST' | 'PUT' },
      string
    >(`/api/products/admin/products/${id}/uploads`, {
      method: 'POST',
      body: { name: file.name, size: file.size, contentType: file.type, visibility, purpose }
    })
    let response: Response
    if (signed.method === 'PUT') {
      response = await fetch(signed.url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file
      })
    } else {
      const body = new FormData()
      for (const [key, value] of Object.entries(signed.fields)) {
        body.append(key, value)
      }
      body.append('file', file)
      response = await fetch(signed.url, { method: 'POST', body })
    }
    if (!response.ok) {
      const failure = (await response.json().catch(() => undefined)) as
        { statusMessage?: string; message?: string } | undefined
      throw new Error(failure?.statusMessage || failure?.message || `Upload failed (${response.status})`)
    }
    await $fetch<unknown, string>(`/api/products/admin/products/${id}/uploads/${signed.id}`, {
      method: 'POST',
      body: crop || {}
    })
    return signed.id
  },
  catalog: (slug: string, locale: string, currency?: string) =>
    $fetch<CatalogProduct, string>(`/api/store/product/${encodeURIComponent(slug)}`, { query: { locale, currency } }),
  checkout: (body: Record<string, unknown>) =>
    $fetch<{ url: string }, string>('/api/store/checkout', { method: 'POST', body }),
  orders: (query: Record<string, unknown>, signal?: AbortSignal) =>
    $fetch<Page<Order>, string>('/api/products/admin/orders', { query, signal }),
  order: (id: string) => $fetch<AdminOrderDetails, string>('/api/products/admin/orders', { query: { orderId: id } }),
  orderLink: (id: string) =>
    $fetch<{ url: string }, string>(`/api/products/admin/orders/${encodeURIComponent(id)}/link`),
  orderAction: (id: string, action: 'retry' | 'fulfill') =>
    $fetch<unknown, string>(`/api/products/admin/orders/${id}/${action}`, { method: 'POST' }),
  settings: () =>
    $fetch<
      {
        checkoutAppearance: CheckoutAppearance
        languages: ('en' | 'nl')[]
        currencies: string[]
        markdownStyle: MarkdownStyle
        currencyTaxBehavior: Record<string, 'inclusive' | 'exclusive'>
        enabled: boolean
        mode: 'sandbox' | 'live'
        defaultLocale: 'en' | 'nl'
        onlinePayment: boolean
        invoicePayment: boolean
        stripeConfigured: boolean
        webhookConfigured: boolean
        storageConfigured: boolean
        storage: StorageSettings
        stripe: StripeSettings
        imagePolicy: ImagePolicy
      },
      string
    >('/api/products/admin/settings'),
  saveSettings: (body: Record<string, unknown>) =>
    $fetch<unknown, string>('/api/products/admin/settings', { method: 'PUT', body }),
  saveStorage: (body: Record<string, unknown>) =>
    $fetch<unknown, string>('/api/products/admin/settings/storage', { method: 'PUT', body }),
  testStorage: (body: Record<string, unknown>) =>
    $fetch<unknown, string>('/api/products/admin/settings/storage/test', { method: 'POST', body }),
  removeStorage: () => $fetch<unknown, string>('/api/products/admin/settings/storage', { method: 'DELETE' }),
  saveStripe: (body: { secretKey?: string; webhookSecret?: string }) =>
    $fetch<unknown, string>('/api/products/admin/settings/stripe', { method: 'PUT', body }),
  testStripe: (body: { secretKey?: string }) =>
    $fetch<{ accountId: string; livemode: boolean }, string>('/api/products/admin/settings/stripe/test', {
      method: 'POST',
      body
    }),
  removeStripe: () => $fetch<unknown, string>('/api/products/admin/settings/stripe', { method: 'DELETE' }),
  purchases: (query: Record<string, unknown>, signal?: AbortSignal) =>
    $fetch<Page<Purchase>, string>('/api/products/purchases', { query, signal }),
  files: (id: string) =>
    $fetch<Array<{ id: string; name: string; content_type: string; size: number }>, string>(
      `/api/products/purchases/${id}/files`
    )
})
