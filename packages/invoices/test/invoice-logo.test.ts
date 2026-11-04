import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import test from 'node:test'
import { PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream } from 'pdf-lib'
import sharp from 'sharp'
import { invoiceLogoCandidates } from '../shared/invoice-logo'
import type { InvoiceDto } from '../shared/types/invoice'

test('invoice branding always prefers the full light logo and falls back to the provider logo', () => {
  assert.deepEqual(invoiceLogoCandidates('portal-light-full', 'provider'), ['portal-light-full', 'provider'])
  assert.deepEqual(invoiceLogoCandidates('', 'provider'), ['provider'])
  assert.deepEqual(invoiceLogoCandidates('  ', 'provider'), ['provider'])
  assert.deepEqual(invoiceLogoCandidates(null, null), [])
  assert.deepEqual(invoiceLogoCandidates('same', 'same'), ['same'])
  const component = readFileSync(new URL('../app/components/InvoicesInvoiceDetail.vue', import.meta.url), 'utf8')
  assert.match(
    component,
    /invoiceLogoCandidates\(portalRuntimeSettings.value\?\.branding\?\.logoLight, props.invoice.senderLogo\)/
  )
  assert.doesNotMatch(component, /markLight|markDark|logoDark|useColorMode|branding\?\.portalName/)
  const repository = readFileSync(new URL('../server/utils/invoice-repository.ts', import.meta.url), 'utf8')
  const detail = repository.split('export const getInvoice =')[1]!.split('export const getNextInvoiceNumber')[0]!
  assert.match(detail, /select\(\{ logo: organization.logo \}\)/)
  assert.match(detail, /eq\(organization.id, organizationId\)/)
  assert.match(detail, /senderLogo: providers\[0\] \? providers\[0\].logo : selected.senderLogo/)
})

test('invoice PDFs embed the full light logo, support WebP, and safely fall back', async (context) => {
  let portalLogo = ''
  Object.assign(globalThis, {
    __invoicePdfBranding: () => ({
      brandName: 'Different portal name',
      brandLogoLight: portalLogo,
      brandLogoDark: 'dark-logo',
      brandIconLight: 'mark',
      brandIconDark: 'dark-mark'
    })
  })
  const hook = registerHooks({
    resolve(specifier, resolverContext, nextResolve) {
      return nextResolve(
        specifier === '@nuxt-customer-portal/core/server/utils/portal-email'
          ? `data:text/javascript,${encodeURIComponent('export const resolvePortalEmailBranding = async () => globalThis.__invoicePdfBranding()')}`
          : specifier,
        resolverContext
      )
    }
  })
  context.after(() => {
    hook.deregister()
    Reflect.deleteProperty(globalThis, '__invoicePdfBranding')
  })
  const { generateInvoicePdf } = await import('../server/utils/invoice-pdf')
  const image = async (width: number, height: number, webp = false) => {
    const source = sharp({ create: { width, height, channels: 3, background: '#543178' } })
    const bytes = await (webp ? source.webp() : source.png()).toBuffer()
    return `data:image/${webp ? 'webp' : 'png'};base64,${bytes.toString('base64')}`
  }
  const invoice: InvoiceDto = {
    id: 'invoice',
    organizationId: 'provider',
    clientOrganizationId: 'client',
    number: '2026.0001',
    documentType: 'invoice',
    status: 'DRAFT',
    currency: 'EUR',
    issueDate: '2026-11-04',
    dueDate: '2026-12-04',
    subject: 'Consulting',
    notes: null,
    senderName: 'Provider Organization',
    senderLogo: await image(80, 80),
    senderAddress: 'Provider Street 1',
    senderCountry: 'NL',
    senderRegistration: '12345678',
    senderVatNumber: 'NL123',
    senderIban: 'NL91ABNA0417164300',
    senderBic: 'ABNANL2A',
    recipientName: 'Client',
    recipientAddress: 'Client Street 2',
    recipientContactName: null,
    recipientEmail: 'client@example.test',
    recipientLocale: 'en',
    issuedAt: null,
    createdAt: '2026-11-04T12:00:00Z',
    updatedAt: '2026-11-04T12:00:00Z',
    lines: [
      {
        id: 'line',
        description: 'Consulting',
        quantityMilli: 1000,
        unit: 'hour',
        unitPriceMinor: 10000,
        vatRateBasisPoints: 2100,
        amountMinor: 10000
      }
    ],
    payments: [],
    history: [],
    attachments: [],
    emailDeliveries: [],
    subtotalMinor: 10000,
    vatMinor: 2100,
    totalMinor: 12100,
    paidMinor: 0,
    outstandingMinor: 12100,
    isOverdue: false,
    daysOverdue: 0,
    reminderCount: 0,
    lastReminderSentAt: null,
    agreedTotalMinor: null,
    taxReviewRequired: false
  }
  const dimensions = async (bytes: Uint8Array) => {
    const document = await PDFDocument.load(bytes)
    const objects = document.getPages()[0]!.node.Resources()?.lookup(PDFName.of('XObject'), PDFDict)
    return (objects?.entries() ?? []).flatMap(([, reference]) => {
      const object = document.context.lookup(reference)
      return object instanceof PDFRawStream && object.dict.get(PDFName.of('Subtype')) === PDFName.of('Image')
        ? [
            [
              object.dict.lookup(PDFName.of('Width'), PDFNumber).asNumber(),
              object.dict.lookup(PDFName.of('Height'), PDFNumber).asNumber()
            ]
          ]
        : []
    })
  }
  portalLogo = await image(200, 40)
  const preview = await generateInvoicePdf(invoice)
  assert.deepEqual(await dimensions(preview), [[200, 40]])
  if (process.env.INVOICE_LOGO_PREVIEW_PATH) {
    writeFileSync(process.env.INVOICE_LOGO_PREVIEW_PATH, preview)
  }
  portalLogo = await image(180, 45, true)
  assert.deepEqual(await dimensions(await generateInvoicePdf(invoice)), [[180, 45]])
  for (const missing of ['', 'data:image/png;base64,bm90LWFuLWltYWdl']) {
    portalLogo = missing
    assert.deepEqual(await dimensions(await generateInvoicePdf(invoice)), [[80, 80]])
  }
  portalLogo = ''
  assert.deepEqual(await dimensions(await generateInvoicePdf({ ...invoice, senderLogo: null })), [])
})
