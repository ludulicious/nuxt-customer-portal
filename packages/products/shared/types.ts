export type Locale = 'en' | 'nl'
export interface ProductCopy {
  title: string
  summary: string
  description: string
}
export interface ProductData {
  slug: string
  type: 'digital' | 'service'
  category: string
  status: 'draft' | 'published' | 'archived'
  content: Record<Locale, ProductCopy>
  taxCode: string
  nextSteps: Record<Locale, string>
  imageIds: string[]
  fileIds: string[]
  videoUrl: string
}
export interface Price {
  id: string
  currency: string
  amount: number
  taxBehavior: 'inclusive' | 'exclusive'
}
export interface Product extends ProductData {
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
  product: ProductData
  title: string
  price: Price
  billing: Billing
  locale: Locale
}
export interface Order {
  id: string
  store_id: string
  product_id: string
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
  fulfilled: boolean
  invoice_id: string | null
  invitation_id: string | null
  notified: boolean
  error: string | null
  created_at: string
  tax_details: unknown
  processing: string
}
export interface CatalogProduct {
  id: string
  slug: string
  type: string
  category: string
  title: string
  summary: string
  descriptionHtml: string
  images: string[]
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
  id: string
  name: string
  productCount: number
}
