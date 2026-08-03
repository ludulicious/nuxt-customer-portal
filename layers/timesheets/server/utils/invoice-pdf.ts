import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { InvoiceDto } from '#layers/timesheets/shared/types/timesheet'

type InvoicePdfLocale = 'en' | 'nl'

const labels = {
  en: { title: 'INVOICE', from: 'From', to: 'Invoice to', number: 'Invoice number', issueDate: 'Invoice date', dueDate: 'Due date', description: 'Description', quantity: 'Quantity', unitPrice: 'Unit price', vat: 'VAT', amount: 'Amount', subtotal: 'Subtotal', paid: 'Paid', total: 'Total payable', notes: 'Notes', page: 'Page' },
  nl: { title: 'FACTUUR', from: 'Van', to: 'Factuur aan', number: 'Factuurnummer', issueDate: 'Factuurdatum', dueDate: 'Vervaldatum', description: 'Omschrijving', quantity: 'Aantal', unitPrice: 'Eenheidsprijs', vat: 'Btw', amount: 'Bedrag', subtotal: 'Subtotaal', paid: 'Betaald', total: 'Te betalen', notes: 'Opmerkingen', page: 'Pagina' }
} as const

const width = 595.28
const height = 841.89
const margin = 48
const ink = rgb(0.12, 0.14, 0.17)
const muted = rgb(0.42, 0.45, 0.5)
const rule = rgb(0.86, 0.87, 0.89)
const accent = rgb(0.12, 0.45, 0.68)

const normalize = (value: string) => value
  .replace(/\r/g, '')
  .replace(/[\u2010-\u2015]/g, '-')
  .replace(/\u2212/g, '-')
  .split('')
  .map((character) => {
    const code = character.codePointAt(0) ?? 0
    return character === '\n' || character === '\t' || (code >= 32 && code <= 255) || code === 8364 ? character : '?'
  })
  .join('')

const wrap = (font: PDFFont, text: string, size: number, maxWidth: number) => {
  const lines: string[] = []
  for (const paragraph of normalize(text).split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    if (!words.length) {
      lines.push('')
      continue
    }
    let line = words.shift()!
    for (const word of words) {
      if (font.widthOfTextAtSize(`${line} ${word}`, size) <= maxWidth) line += ` ${word}`
      else {
        lines.push(line)
        line = word
      }
    }
    lines.push(line)
  }
  return lines
}

export async function generateInvoicePdf(invoice: InvoiceDto, requestedLocale?: string) {
  const locale: InvoicePdfLocale = requestedLocale?.toLowerCase().startsWith('nl') ? 'nl' : 'en'
  const l = labels[locale]
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const money = (minor: number) => new Intl.NumberFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', { style: 'currency', currency: invoice.currency }).format(minor / 100)
  const number = (milli: number) => new Intl.NumberFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(milli / 1000)
  const date = (value: string) => new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))
  let page!: PDFPage
  let y = 0

  const addPage = () => {
    page = pdf.addPage([width, height])
    y = height - margin
    page.drawText(invoice.number, { x: margin, y: 25, size: 8, font: regular, color: muted })
    return page
  }
  const text = (value: string, x: number, size = 9, font = regular, color = ink) => page.drawText(normalize(value), { x, y, size, font, color })
  const multiline = (value: string, x: number, maxWidth: number, size = 9, font = regular, lineHeight = 13, color = ink) => {
    for (const line of wrap(font, value, size, maxWidth)) {
      text(line, x, size, font, color)
      y -= lineHeight
    }
  }
  const divider = () => page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.7, color: rule })

  addPage()
  let logoDrawn = false
  if (invoice.senderLogo?.startsWith('data:image/')) {
    try {
      const [, meta, data] = invoice.senderLogo.match(/^data:(image\/(?:png|jpeg|jpg));base64,(.+)$/i) ?? []
      if (meta && data) {
        const bytes = Buffer.from(data, 'base64')
        const image = meta.toLowerCase() === 'image/png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes)
        const scale = Math.min(150 / image.width, 55 / image.height, 1)
        page.drawImage(image, { x: margin, y: y - image.height * scale + 4, width: image.width * scale, height: image.height * scale })
        logoDrawn = true
      }
    } catch { /* A malformed optional logo must not prevent invoice generation. */ }
  }
  if (!logoDrawn) text(invoice.senderName, margin, 16, bold, accent)
  page.drawText(l.title, { x: width - margin - bold.widthOfTextAtSize(l.title, 22), y, size: 22, font: bold, color: ink })
  y -= 28
  const fromX = width - margin - 205
  page.drawText(l.from, { x: fromX, y, size: 8, font: bold, color: muted })
  y -= 14
  multiline(`${invoice.senderName}\n${invoice.senderAddress}`, fromX, 205, 9, regular, 12)
  y = Math.min(y - 30, height - 170)

  const partiesY = y
  text(l.to, margin, 8, bold, muted)
  y -= 15
  multiline(`${invoice.recipientName}\n${invoice.recipientAddress}${invoice.recipientContactName ? `\n${invoice.recipientContactName}` : ''}${invoice.recipientEmail ? `\n${invoice.recipientEmail}` : ''}`, margin, 235, 9, regular, 12)
  y = partiesY
  const metaX = 355
  for (const [label, value] of [[l.number, invoice.number], [l.issueDate, date(invoice.issueDate)], [l.dueDate, date(invoice.dueDate)]]) {
    text(label!, metaX, 8, regular, muted)
    page.drawText(normalize(value!), { x: width - margin - regular.widthOfTextAtSize(normalize(value!), 9), y, size: 9, font: regular, color: ink })
    y -= 17
  }
  y = Math.min(y, partiesY - 85)
  if (invoice.subject) {
    divider()
    y -= 16
    text(invoice.subject, margin, 10, bold)
    y -= 20
  }
  y -= 8

  const cols = [margin, 304, 365, 431, width - margin]
  const tableHeader = () => {
    text(l.description, cols[0]!, 8, bold, muted)
    for (const [label, right] of [[l.quantity, cols[2]! - 8], [l.unitPrice, cols[3]! - 8], [l.vat, cols[4]! - 74], [l.amount, cols[4]!]]) {
      page.drawText(label as string, { x: (right as number) - bold.widthOfTextAtSize(label as string, 8), y, size: 8, font: bold, color: muted })
    }
    y -= 10
    divider()
    y -= 13
  }
  tableHeader()
  for (const line of invoice.lines) {
    const description = wrap(regular, line.description, 8.5, cols[1]! - cols[0]! - 12)
    const rowHeight = Math.max(24, description.length * 11 + 8)
    if (y - rowHeight < 155) {
      addPage()
      y -= 22
      tableHeader()
    }
    const rowTop = y
    description.forEach((value, index) => page.drawText(value, { x: cols[0]!, y: rowTop - index * 11, size: 8.5, font: regular, color: ink }))
    const values = [number(line.quantityMilli), money(line.unitPriceMinor), `${line.vatRateBasisPoints / 100}%`, money(line.amountMinor)]
    const rights = [cols[2]! - 8, cols[3]! - 8, cols[4]! - 74, cols[4]!]
    values.forEach((value, index) => page.drawText(normalize(value), { x: rights[index]! - regular.widthOfTextAtSize(normalize(value), 8.5), y: rowTop, size: 8.5, font: regular, color: ink }))
    y -= rowHeight
    divider()
    y -= 10
  }
  if (y < 160) addPage()
  const summaryX = 340
  const summary: Array<[string, number]> = [[l.subtotal, invoice.subtotalMinor], [l.vat, invoice.vatMinor]]
  if (invoice.paidMinor) summary.push([l.paid, -invoice.paidMinor])
  for (const [label, value] of summary) {
    text(label, summaryX, 9, regular, muted)
    const formatted = money(value)
    page.drawText(normalize(formatted), { x: width - margin - regular.widthOfTextAtSize(normalize(formatted), 9), y, size: 9, font: regular, color: ink })
    y -= 17
  }
  divider()
  y -= 18
  text(l.total, summaryX, 10, bold)
  const total = money(invoice.outstandingMinor)
  page.drawText(normalize(total), { x: width - margin - bold.widthOfTextAtSize(normalize(total), 10), y, size: 10, font: bold, color: ink })
  y -= 34
  if (invoice.notes) {
    if (y < 95) addPage()
    text(l.notes, margin, 8, bold, muted)
    y -= 15
    multiline(invoice.notes, margin, width - margin * 2, 8.5, regular, 12)
  }

  const pages = pdf.getPages()
  pages.forEach((pdfPage, index) => {
    const value = `${l.page} ${index + 1} / ${pages.length}`
    pdfPage.drawText(value, { x: width - margin - regular.widthOfTextAtSize(value, 8), y: 25, size: 8, font: regular, color: muted })
  })
  pdf.setTitle(`${l.title} ${invoice.number}`)
  pdf.setAuthor(invoice.senderName)
  pdf.setCreator('Ludu Customer Portal')
  return pdf.save()
}
