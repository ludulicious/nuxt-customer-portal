import type { Order } from './types'
import { hasPurchaseAccess } from './access'

export function downloadableLine(order: Order, assetId: string) {
  if (!hasPurchaseAccess(order)) {
    return undefined
  }
  return order.lines.find((line) => hasPurchaseAccess(order, line) && line.snapshot.product.fileIds.includes(assetId))
}

export function purchaseReturnUrl(returnUrl: string | undefined, token: string) {
  if (!returnUrl) {
    return undefined
  }
  const url = new URL(returnUrl)
  url.searchParams.set('purchase', token)
  return url.toString()
}

export interface PurchaseDownload {
  id: string
  name: string
  url: string
}

export function downloadLinksMarkdown(files: PurchaseDownload[]) {
  const escape = (value: string) => value.replace(/[\\`*_[\]<>]/g, '\\$&').replace(/[\r\n]/g, ' ')
  return files
    .map(
      (file) =>
        `- [${escape(file.name)}](${file.url.replace(/[\s()<>\\]/g, (char) => encodeURIComponent(char).replace(/\(/g, '%28').replace(/\)/g, '%29'))})`
    )
    .join('\n')
}

export function downloadEmailMarkdown(files: PurchaseDownload[], locale: string) {
  if (!files.length) {
    return ''
  }
  return `${locale === 'nl' ? 'Download je bestanden' : 'Download your files'}:\n\n${downloadLinksMarkdown(files)}`
}
