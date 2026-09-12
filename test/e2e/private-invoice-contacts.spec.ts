import assert from 'node:assert/strict'
import { request, test, type APIResponse } from '@playwright/test'

test.skip(!process.env.PORTAL_PERSONAL_E2E, 'Requires an isolated portal with the documented coaching fixtures')
test('private invoices use the client email without contact persons and preserve snapshots', async () => {
  const ctx = await request.newContext({
    baseURL: process.env.PORTAL_PERSONAL_E2E_URL || 'http://localhost:4193',
    extraHTTPHeaders: { Origin: process.env.PORTAL_PERSONAL_E2E_URL || 'http://localhost:4193' }
  })
  const ok = async (res: APIResponse) => {
    assert.equal(res.status(), 200, await res.text())
    return res.json()
  }
  await ok(
    await ctx.post('/api/auth/sign-in/email', {
      data: { email: 'coach@example.test', password: 'Portal-test-password-2026!' }
    })
  )
  await ok(await ctx.post('/api/auth/organization/set-active', { data: { organizationId: 'provider' } }))
  await ok(
    await ctx.put('/api/invoices/admin/settings', {
      data: {
        enabled: true,
        currency: 'EUR',
        defaultVatRateBasisPoints: 2100,
        address: 'Coach street 1',
        registrationNumber: '12345678',
        vatNumber: 'NL123',
        iban: 'NL91ABNA0417164300',
        bic: 'ABNANL2A',
        invoiceEmail: 'coach@example.test',
        preferredLocale: 'en'
      }
    })
  )
  const privateClient = await ok(
    await ctx.post('/api/clients', {
      data: {
        clientType: 'person',
        name: 'Private Invoice Client',
        address: 'Private street 2',
        invoiceEmail: 'private@example.test'
      }
    })
  )
  const company = await ok(
    await ctx.post('/api/clients', {
      data: { name: 'Company', slug: 'invoice-company', officialName: 'Company BV', address: 'Company street 3' }
    })
  )
  const endpoint = (id: string) => `/api/invoices/admin/clients/${id}/contacts`
  const contactData = { name: 'Company contact', email: 'contact@example.test' }
  assert.equal((await ctx.post(endpoint(privateClient.id), { data: contactData })).status(), 403)
  assert.deepEqual(await ok(await ctx.get(endpoint(privateClient.id))), [])
  const contact = await ok(await ctx.post(endpoint(company.id), { data: contactData }))
  const invoiceData = {
    clientOrganizationId: privateClient.id,
    number: 'TEST-001',
    currency: 'EUR',
    issueDate: '2026-09-10',
    dueDate: '2026-10-10',
    lines: [
      { description: 'Coaching', quantityMilli: 1000, unit: 'hour', unitPriceMinor: 10000, vatRateBasisPoints: 2100 }
    ]
  }
  assert.equal(
    (await ctx.post('/api/invoices/admin/invoices', { data: { ...invoiceData, contactId: contact.id } })).status(),
    400
  )
  const invoice = await ok(await ctx.post('/api/invoices/admin/invoices', { data: invoiceData }))
  assert.equal(invoice.recipientEmail, 'private@example.test')
  assert.equal(invoice.recipientContactName, null)
  assert.equal(invoice.recipientName, 'Private Invoice Client')
  const businessInvoice = await ok(
    await ctx.post('/api/invoices/admin/invoices', {
      data: { ...invoiceData, number: 'TEST-002', clientOrganizationId: company.id, contactId: contact.id }
    })
  )
  assert.equal(businessInvoice.recipientEmail, 'contact@example.test')
  assert.equal(businessInvoice.recipientContactName, 'Company contact')
  await ok(
    await ctx.patch('/api/clients/' + privateClient.id, {
      data: { name: 'Changed name', address: 'New address', invoiceEmail: 'changed@example.test' }
    })
  )
  const historical = await ok(await ctx.get('/api/invoices/admin/invoices/' + invoice.id))
  const snapshot = historical.invoice || historical
  assert.equal(snapshot.recipientEmail, 'private@example.test')
  assert.equal(snapshot.recipientName, 'Private Invoice Client')
  console.log(
    'PASS: private draft without contacts, own recipient email, rejected contact creation/selection, B2B contacts preserved, snapshots preserved'
  )
  await ctx.dispose()
})
