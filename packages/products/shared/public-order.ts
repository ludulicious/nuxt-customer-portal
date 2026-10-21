import type { Locale, Order } from './types'
import type { CheckoutAppearance } from './checkout-appearance'
import type { PurchaseDownload } from './downloads'
import type { PurchaseLink } from './links'

export interface PublicOrderFile extends PurchaseDownload {
  previewUrl: string
  content_type: string
  size: number
}
export interface PublicOrderDetails {
  reference: string
  createdAt: string
  locale: Locale
  status: Order['status']
  access: boolean
  total: number | null
  currency: string
  appearance: CheckoutAppearance
  items: Array<{
    id: string
    title: string
    quantity: number
    amount: number | null
    access: boolean
    nextSteps: string
    filesPending: boolean
    files: PublicOrderFile[]
    links: PurchaseLink[]
  }>
}
