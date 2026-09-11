import type { Product, Page, Asset, CatalogProduct, Order, ProductCategory, ProductPreview } from '../../shared/types'
import type { z } from 'zod'
import type { productSchema } from '../../shared/validation'

type ProductInput = z.infer<typeof productSchema>
export const useProducts = () => ({
  preview: (id: string) => $fetch<ProductPreview>(`/api/products/admin/products/${encodeURIComponent(id)}/preview`),
  previewImageUrl: (id: string, assetId: string) =>
    `/api/products/admin/products/${encodeURIComponent(id)}/images/${encodeURIComponent(assetId)}`,

  categories: () => $fetch<ProductCategory[]>('/api/products/admin/categories'),
  saveCategory: (name: string, id?: string) =>
    $fetch<{ id: string; name: string }>(
      id ? `/api/products/admin/categories/${id}` : '/api/products/admin/categories',
      { method: id ? 'PUT' : 'POST', body: { name } }
    ),
  deleteCategory: (id: string, name: string) =>
    $fetch(`/api/products/admin/categories/${id}`, { method: 'DELETE', body: { name } }),
  checkoutClients: () => $fetch<Array<{ id: string; name: string }>>('/api/products/checkout-clients'),
  list: (query: Record<string, unknown>, signal?: AbortSignal) =>
    $fetch<Page<Product>>('/api/products/admin/products', { query, signal }),
  get: (id: string) => $fetch<Product>(`/api/products/admin/products/${encodeURIComponent(id)}`),
  save: (input: ProductInput, id?: string) =>
    $fetch<Product>(id ? `/api/products/admin/products/${id}` : '/api/products/admin/products', {
      method: id ? 'PUT' : 'POST',
      body: input
    }),
  deletion: (id: string) => $fetch<{ eligible: boolean }>(`/api/products/admin/products/${id}/deletion`),
  remove: (id: string, name: string) =>
    $fetch(`/api/products/admin/products/${id}`, { method: 'DELETE', body: { name } }),
  assets: (id: string) => $fetch<Asset[]>(`/api/products/admin/products/${id}/assets`),
  async upload(id: string, file: File, visibility: 'public' | 'private') {
    const signed = await $fetch<{ id: string; url: string; fields: Record<string, string> }>(
      `/api/products/admin/products/${id}/uploads`,
      { method: 'POST', body: { name: file.name, size: file.size, contentType: file.type, visibility } }
    )
    const body = new FormData()
    for (const [key, value] of Object.entries(signed.fields)) {
      body.append(key, value)
    }
    body.append('file', file)
    const response = await fetch(signed.url, { method: 'POST', body })
    if (!response.ok) {
      throw new Error('Upload failed')
    }
    await $fetch(`/api/products/admin/products/${id}/uploads/${signed.id}`, { method: 'POST' })
    return signed.id
  },
  catalog: (slug: string, locale: string) =>
    $fetch<CatalogProduct>(`/api/store/product/${encodeURIComponent(slug)}`, { query: { locale } }),
  checkout: (body: Record<string, unknown>) => $fetch<{ url: string }>('/api/store/checkout', { method: 'POST', body }),
  orders: (query: Record<string, unknown>) => $fetch<Page<Order>>('/api/products/admin/orders', { query }),
  orderAction: (id: string, action: 'retry' | 'fulfill') =>
    $fetch(`/api/products/admin/orders/${id}/${action}`, { method: 'POST' }),
  settings: () =>
    $fetch<{
      currencies: string[]
      enabled: boolean
      defaultLocale: 'en' | 'nl'
      stripeConfigured: boolean
      webhookConfigured: boolean
      storageConfigured: boolean
    }>('/api/products/admin/settings'),
  saveSettings: (body: Record<string, unknown>) => $fetch('/api/products/admin/settings', { method: 'PUT', body }),
  keys: () =>
    $fetch<
      Array<{
        id: string
        name: string
        prefix: string
        expires_at: string | null
        revoked_at: string | null
        last_used_at: string | null
      }>
    >('/api/products/admin/keys'),
  createKey: (body: Record<string, unknown>) =>
    $fetch<{ key: string }>('/api/products/admin/keys', { method: 'POST', body }),
  revoke: (id: string) => $fetch(`/api/products/admin/keys/${id}`, { method: 'DELETE' }),
  purchases: () =>
    $fetch<
      Array<{
        id: string
        title: string
        type: string
        amount: number
        currency: string
        access: boolean
        refunded: number
        disputed: boolean
        fulfilled: boolean
        invoiceId: string | null
        nextSteps: string
        fileIds: string[]
        createdAt: string
      }>
    >('/api/products/purchases'),
  files: (id: string) =>
    $fetch<Array<{ id: string; name: string; content_type: string; size: number }>>(
      `/api/products/purchases/${id}/files`
    )
})
