import assert from 'node:assert/strict'
import { request, test } from '@playwright/test'

// Requires a fresh disposable SaaS portal with the coach/person fixtures used by personal-clients.spec.ts.
test.skip(!process.env.PORTAL_SAAS_SETTINGS_E2E, 'Requires an isolated SaaS test portal')
test('SaaS client settings govern creation and reject conflicting concurrent changes', async () => {
  const baseURL = process.env.PORTAL_SAAS_SETTINGS_E2E_URL || 'http://localhost:4193'
  const coach = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } })
  const person = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } })
  for (const [ctx, email] of [
    [coach, 'coach@example.test'],
    [person, 'person@example.test']
  ] as const) {
    const res = await ctx.post('/api/auth/sign-in/email', { data: { email, password: 'Portal-test-password-2026!' } })
    assert.equal(res.status(), 200, await res.text())
  }
  let response = await coach.get('/api/admin/portal-settings')
  assert.equal(response.status(), 200, await response.text())
  let settings = (await response.json()).settings
  assert.deepEqual(settings.clients, { allowedTypes: ['organization', 'person'], personalSelfRegistration: true })
  response = await coach.post('/api/admin/portal-settings/complete', { data: { settings } })
  assert.equal(response.status(), 200, await response.text())
  const save = async (clients: { allowedTypes: string[]; personalSelfRegistration: boolean }) =>
    coach.put('/api/admin/portal-settings', { data: { settings: { ...settings, clients }, step: 'clients' } })
  response = await save({ allowedTypes: ['organization'], personalSelfRegistration: false })
  assert.equal(response.status(), 200, await response.text())
  let publicSettings = await (await coach.get('/api/portal/public')).json()
  assert.deepEqual(publicSettings.clients, { allowedTypes: ['organization'], personalSelfRegistration: false })
  response = await coach.post('/api/auth/organization/set-active', { data: { organizationId: 'provider' } })
  assert.equal(response.status(), 200)
  response = await coach.post('/api/clients', { data: { name: 'Blocked Person', clientType: 'person' } })
  assert.equal(response.status(), 403, await response.text())
  const onboard = () =>
    person.post('/api/personal-client', {
      data: { firstName: 'Private', lastName: 'Person', preferredLocale: 'en', timezone: 'Europe/Amsterdam' }
    })
  response = await onboard()
  assert.equal(response.status(), 403, await response.text())
  response = await coach.post('/api/clients', {
    data: { name: 'Company', slug: 'company', officialName: 'Company BV' }
  })
  assert.equal(response.status(), 200, await response.text())
  response = await save({ allowedTypes: ['person'], personalSelfRegistration: false })
  assert.equal(response.status(), 409, await response.text())
  response = await save({ allowedTypes: ['organization', 'person'], personalSelfRegistration: true })
  assert.equal(response.status(), 200, await response.text())
  const [created, disabled] = await Promise.all([
    onboard(),
    save({ allowedTypes: ['organization'], personalSelfRegistration: false })
  ])
  assert.ok(
    (created.status() === 200 && disabled.status() === 409) || (created.status() === 403 && disabled.status() === 200),
    `${created.status()} / ${disabled.status()}`
  )
  console.log(
    'PASS: stored settings override host defaults; B2B blocks creation/onboarding; existing types cannot be disabled; concurrent changes preserve consistency'
  )
  await coach.dispose()
  await person.dispose()
})
