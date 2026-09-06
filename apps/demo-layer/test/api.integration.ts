import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import { request, chromium } from '@playwright/test'

const baseURL = process.env.DEMO_TEST_URL || 'http://localhost:3054'
assert.equal(new URL(baseURL).hostname, 'localhost', 'Use a disposable localhost demo for integration tests')
const a = await request.newContext({ baseURL })
const b = await request.newContext({ baseURL })
const session = await (await a.get('/api/auth/get-session')).json()
assert.equal(session.user.id, 'demo-admin')
assert.equal((await (await a.get('/api/auth/permissions')).json()).role, 'admin')
const invoiceBootstrap = await a.get('/api/invoices/admin/bootstrap')
assert.equal(invoiceBootstrap.status(), 200)
const { organizationProfile } = await invoiceBootstrap.json()
for (const field of ['address', 'registrationNumber', 'vatNumber', 'iban', 'bic', 'invoiceEmail']) {
  assert.ok(organizationProfile[field]?.trim(), `Demo sender must include ${field} so invoice creation is available`)
}
for (const [method, path] of [
  ['POST', '/api/auth/admin/ban-user'],
  ['POST', '/api/auth/admin/unban-user'],
  ['POST', '/api/auth/sign-up/email'],
  ['POST', '/api/auth/organization/invite-member'],
  ['POST', '/api/auth/change-password'],
  ['POST', '/api/auth/update-user'],
  ['PATCH', '/api/profile'],
  ['PATCH', '/api/admin/users/demo-member/role'],
  ['PUT', '/api/timesheets/client/demo-garden/reviewers'],
  ['POST', '/api/admin/email/test']
]) {
  const response = await a.fetch(path!, { method, data: {} })
  assert.equal(response.status(), 403, path)
  assert.equal((await response.json()).data.code, 'DEMO_RESTRICTED', path)
}
const dutch = await a.patch('/api/profile', { headers: { cookie: 'i18n_redirected=nl' }, data: {} })
assert.match((await dutch.json()).message, /Deze actie/)
const create = await a.post('/api/service-requests', {
  data: {
    title: 'Shared demo integration check',
    description: 'A shared record created by the integration test',
    clientOrganizationId: 'demo-garden',
    priority: 'LOW'
  }
})
assert.equal(create.status(), 200, await create.text())
const record = await create.json()
assert.equal((await b.get(`/api/service-requests/${record.id}`)).status(), 200)
const update = await a.patch(`/api/service-requests/${record.id}`, { data: { title: 'Updated shared request' } })
assert.equal(update.status(), 200, await update.text())
assert.equal((await (await b.get(`/api/service-requests/${record.id}`)).json()).title, 'Updated shared request')
assert.equal((await a.delete(`/api/service-requests/${record.id}`)).status(), 200)
for (const id of [
  'demo-member',
  'demo-owner',
  'demo-manager',
  'demo-client-owner',
  'demo-client-admin',
  'demo-client-member',
  'demo-admin'
]) {
  const result = await a.post('/api/demo/switch', { data: { userId: id } })
  assert.equal(result.status(), 200, await result.text())
  const current = await (await a.get('/api/auth/get-session')).json()
  assert.equal(current.user.id, id)
  const permissions = await (await a.get('/api/auth/permissions')).json()
  assert.equal(permissions.role, id === 'demo-admin' ? 'admin' : 'user')
  if (id === 'demo-member') {
    assert.equal((await a.get('/api/admin/users')).status(), 403)
  }
}
assert.equal((await a.post('/api/demo/switch', { data: { userId: 'not-seeded' } })).status(), 400)
console.log(
  'API integration passed: anonymous access, shared CRUD, seven identities, permissions, restrictions, localization'
)
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.goto(`${baseURL}/dashboard`)
await page.getByText('Shared demo · Changes reset daily.', { exact: true }).waitFor()
await page.getByRole('combobox', { name: 'Explore as' }).waitFor()
await page.screenshot({ path: join(tmpdir(), 'portal-demo-dashboard.png'), fullPage: true })
assert.equal(new URL(page.url()).pathname, '/dashboard')
await page.goto(`${baseURL}/settings`)
await page.locator('input[name="name"]').fill('Changed sample name')
await page.locator('button[type="submit"]').click()
await page
  .getByText('This action is unavailable in the demo. No changes have been applied.', { exact: true })
  .first()
  .waitFor()
console.log('Browser smoke passed: anonymous dashboard and persistent user switcher')
await browser.close()
await a.dispose()
await b.dispose()
