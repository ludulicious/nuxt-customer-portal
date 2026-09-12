import type { MarkdownStyle } from './markdown-style'

export type Locale = 'en' | 'nl'
export interface ProductCopy {
  title: string
  subtitle?: string
  buyButtonLabel?: string
  secondaryCta?: string
  summary: string
  description: string
}
export interface ProductData {
  isFree?: boolean
  slug: string
  type: 'digital' | 'service'
  status: 'draft' | 'published' | 'archived'
  content: Record<Locale, ProductCopy>
  taxCode: string
  nextSteps: Record<Locale, string>
  imageIds: string[]
  thumbnailImageId: string | null
  galleryImageIds: string[]
  detailImageIds: string[]
  fileIds: string[]
  fileNames: Record<string, Record<Locale, string>>
  videoUrl: string
}
export interface Price {
  id: string
  currency: string
  amount: number
  taxBehavior: 'inclusive' | 'exclusive'
}
export interface Product extends ProductData {
  categoryId: string | null
  categoryName?: string
  categoryContent?: Record<Locale, { name: string; description: string }>
  id: string
  prices: Price[]
  updatedAt: string
}
export interface Asset {
  id: string
  product_id: string
  name: string
  content_type: string
  size: number
  visibility: 'public' | 'private'
  ready: boolean
  status: 'uploading' | 'processing' | 'ready' | 'failed'
  width: number | null
  height: number | null
  failure_reason?: string | null
  image_purpose?: ImagePurpose | null
}
export type ImagePurpose = 'thumbnail' | 'gallery' | 'detail'
export interface ImageSize {
  width: number
  height: number
}
export interface ImagePolicy {
  thumbnail: ImageSize
  gallery: ImageSize
  detail: ImageSize
}
export interface StorageSettings {
  provider: 's3' | 'bunny'
  source: 'environment' | 'store' | 'missing'
  configured: boolean
  tested: boolean
  endpoint: string
  region: string
  bucket: string
  pathStyle: boolean
  accessKeySuffix: string
}
export interface Billing {
  type: 'person' | 'organization'
  name: string
  email: string
  company: string
  address: string
  country: string
  registrationNumber: string
  vatNumber: string
  clientId?: string
}
export interface OrderSnapshot {
  billing: Billing
  locale: Locale
}
export interface OrderLineSnapshot {
  product: ProductData
  title: string
  price: Price
}
export interface OrderLine {
  id: string
  order_id: string
  position: number
  product_id: string
  price_id: string
  quantity: number
  snapshot: OrderLineSnapshot
  unit_amount: number
  total: number | null
  net: number | null
  tax: number | null
  tax_details: unknown
  refunded: number
  fulfilled: boolean
  created_at: string
}
export interface Order {
  id: string
  store_id: string
  cart_id: string | null
  buyer_id: string | null
  client_id: string | null
  email: string
  snapshot: OrderSnapshot
  status: 'pending' | 'paid' | 'failed' | 'expired'
  checkout_id: string | null
  payment_id: string | null
  total: number | null
  net: number | null
  tax: number | null
  refunded: number
  disputed: boolean
  invoice_id: string | null
  invitation_id: string | null
  notified: boolean
  error: string | null
  created_at: string
  updated_at: string
  tax_details: unknown
  processing: string
  lines: OrderLine[]
}
export interface Cart {
  id: string
  store_id: string
  buyer_id: string | null
  token_hash: string
  status: 'active' | 'converted' | 'expired'
  locale: Locale
  currency: string
  expires_at: string
  created_at: string
  updated_at: string
  lines: CartLine[]
}
export interface CartLine {
  id: string
  cart_id: string
  product_id: string
  price_id: string
  quantity: number
  created_at: string
  updated_at: string
}
export interface CatalogProduct {
  markdownStyle: MarkdownStyle
  imagePolicy: ImagePolicy
  summaryHtml: string
  categoryId: string | null
  categoryDetails?: { code: string; name: string; description: string }
  isFree: boolean
  pricingComplete: boolean
  id: string
  slug: string
  type: string
  category: string
  title: string
  subtitle?: string
  buyButtonLabel: string
  secondaryCta: string
  summary: string
  descriptionHtml: string
  images: string[]
  thumbnailImage: string | null
  detailImages: string[]
  videoUrl: string
  prices: Price[]
  purchaseUrl: string
  locale: Locale
}
export interface Page<T> {
  items: T[]
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number }
}

export interface ProductCategory {
  code: string
  content: Record<Locale, { name: string; description: string }>
  id: string
  name: string
  productCount: number
}

export interface ProductPreview {
  markdownStyle: MarkdownStyle
  languages: Locale[]
  currencies: string[]
  product: Product
  defaultLocale: Locale
  content: Record<
    Locale,
    {
      title: string
      subtitle?: string
      buyButtonLabel: string
      secondaryCta: string
      summary: string
      summaryHtml: string
      descriptionHtml: string
    }
  >
}
