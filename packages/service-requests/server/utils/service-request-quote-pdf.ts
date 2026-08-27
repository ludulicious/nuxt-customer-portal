import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { ServiceRequestDto, ServiceRequestQuoteDto } from '@nuxt-customer-portal/service-requests/shared/types/service-request'

export const generateServiceRequestQuotePdf = async (request: ServiceRequestDto, quote: ServiceRequestQuoteDto, requestedLocale?: string) => {
  const nl = requestedLocale?.toLowerCase().startsWith('nl')
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842])
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const money = (minor: number) => new Intl.NumberFormat(nl ? 'nl-NL' : 'en-GB', { style: 'currency', currency: quote.currency }).format(minor / 100)
  let y = 785
  const draw = (text: string, size = 10, strong = false, x = 48) => {
    page.drawText(text.replace(/[^\x20-\xFF]/g, '?'), { x, y, size, font: strong ? bold : regular, color: rgb(0.12, 0.14, 0.17) })
    y -= size + 9
  }
  draw(nl ? 'OFFERTE' : 'QUOTE', 24, true)
  draw(`${nl ? 'Nummer' : 'Number'}: ${quote.number}`, 11, true)
  draw(`${nl ? 'Geldig tot' : 'Valid until'}: ${quote.validUntil}`)
  draw(`${nl ? 'Voor' : 'For'}: ${request.clientName || request.clientOrganizationId}`)
  draw(request.title, 14, true)
  y -= 10
  for (const line of quote.lines) {
    draw(line.description, 10, true)
    draw(`${line.quantityMilli / 1000} ${line.unit} × ${money(line.unitPriceMinor)}   ${money(line.amountMinor + line.vatMinor)}`, 9)
  }
  y -= 10
  draw(`${nl ? 'Subtotaal' : 'Subtotal'}: ${money(quote.subtotalMinor)}`, 11)
  draw(`${nl ? 'Btw' : 'VAT'}: ${money(quote.vatMinor)}`, 11)
  draw(`${nl ? 'Totaal' : 'Total'}: ${money(quote.totalMinor)}`, 13, true)
  if (quote.notes) {
    y -= 12
    draw(nl ? 'Opmerkingen' : 'Notes', 11, true)
    draw(quote.notes.slice(0, 500), 9)
  }
  return pdf.save()
}
