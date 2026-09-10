import { expect, test, type APIRequestContext } from '@playwright/test'

test.skip(!process.env.PORTAL_PERSONAL_E2E, 'Requires the documented isolated coaching test portal')
const password = 'Portal-test-password-2026!'
const login = async (request: APIRequestContext, email: string) => {
  const response = await request.post('/api/auth/sign-in/email', { data: { email, password } })
  expect(response.ok(), await response.text()).toBeTruthy()
}

test('personal onboarding, saved timezone, access isolation and company compatibility', async ({
  page,
  playwright,
  baseURL
}) => {
  const coach = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL! } })
  await login(coach, 'coach@example.test')
  expect(
    (await coach.post('/api/auth/organization/set-active', { data: { organizationId: 'provider' } })).ok()
  ).toBeTruthy()
  const companyResponse = await coach.post('/api/clients', {
    data: { name: 'Business Client', slug: `business-${Date.now()}`, officialName: 'Business Client BV' }
  })
  expect(companyResponse.ok(), await companyResponse.text()).toBeTruthy()
  const company = await companyResponse.json()
  expect(company.clientType).toBe('organization')
  await login(page.request, 'person@example.test')
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/personal-onboarding/)
  await expect(page.getByRole('heading', { name: 'Personal account' })).toBeVisible()
  await page.getByLabel('First name', { exact: true }).fill('Personal')
  await page.getByLabel('Last name', { exact: true }).fill('Client')
  await page.getByRole('button', { name: 'Open personal account', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 })
  const accounts = await (await page.request.get('/api/client-account')).json()
  const personal = accounts.find((account: { clientType: string }) => account.clientType === 'person')
  expect(personal).toBeTruthy()
  const session = await (await page.request.get('/api/auth/get-session')).json()
  expect(session.user.firstName).toBe('Personal')
  expect(session.user.lastName).toBe('Client')
  const repeat = await page.request.post('/api/personal-client', {
    data: { firstName: 'Personal', lastName: 'Client', preferredLocale: 'en', timezone: 'UTC' }
  })
  expect(repeat.ok(), await repeat.text()).toBeTruthy()
  expect((await repeat.json()).id).toBe(personal.organizationId)
  const blocked = await page.request.post(`/api/clients/${personal.organizationId}/invitations`, {
    data: { email: 'nobody@example.test', role: 'owner' }
  })
  expect(blocked.status()).toBe(403)
  const authBlocked = await page.request.post('/api/auth/organization/invite-member', {
    data: { organizationId: personal.organizationId, email: 'nobody@example.test', role: 'owner' }
  })
  expect(authBlocked.status()).toBe(403)
  expect((await page.request.get(`/api/clients/${company.id}`)).status()).toBe(403)
  expect((await page.request.patch('/api/profile', { data: { timezone: 'America/New_York' } })).ok()).toBeTruthy()
  expect((await (await page.request.get('/api/timezones')).json()).displayTimezone).toBe('America/New_York')
  await page.goto('/settings/organization')
  await expect(page.getByRole('heading', { name: /Personal account/ })).toBeVisible()
  await expect(page.getByText('Members', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Edit personal profile', exact: true }).click()
  await expect(page.getByText('Full name', { exact: true })).toBeVisible()
  await expect(page.getByText('VAT number', { exact: true })).toHaveCount(0)
  await page.screenshot({ path: 'test-results/personal-clients/personal-profile.png', fullPage: true })
  await coach.dispose()
})

test('personal invitations enforce verification, one account, and archive boundaries', async ({
  playwright,
  baseURL
}) => {
  test.skip(!process.env.PORTAL_TEST_DATABASE_URL, 'Requires disposable database fixture access')
  const { Client } = await import('pg')
  const connectionString = process.env.PORTAL_TEST_DATABASE_URL!
  expect(new URL(connectionString).pathname).toMatch(/codex_clients_test_/)
  const db = new Client({ connectionString })
  await db.connect()
  const coach = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL! } })
  const invited = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL! } })
  try {
    await login(coach, 'coach@example.test')
    await coach.post('/api/auth/organization/set-active', { data: { organizationId: 'provider' } })
    await login(invited, 'other@example.test')
    // Reset only this disposable fixture user's memberships, allowing repeated test runs.
    await db.query("DELETE FROM member WHERE user_id='other'")
    const create = async (name: string) => {
      const response = await coach.post('/api/clients', {
        data: { name, clientType: 'person', moduleIds: ['invoices'] }
      })
      expect(response.ok(), await response.text()).toBeTruthy()
      return response.json()
    }
    const first = await create('Invited Person')
    const second = await create('Second Account')
    for (const client of [first, second]) {
      await db.query(
        "INSERT INTO invitation (id,organization_id,email,role,status,expires_at,inviter_id) VALUES ($1,$2,'other@example.test','owner','pending',now()+interval '1 day','coach')",
        [`invite-${client.id}`, client.id]
      )
    }
    await db.query('UPDATE "user" SET email_verified=false WHERE id=\'other\'')
    expect(
      (
        await invited.post('/api/organizations/accept-invitation', { data: { invitationId: `invite-${first.id}` } })
      ).status()
    ).toBe(403)
    expect(
      (
        await invited.post('/api/personal-client', {
          data: { firstName: 'Other', lastName: 'Client', preferredLocale: 'en', timezone: 'UTC' }
        })
      ).status()
    ).toBe(403)
    await db.query('UPDATE "user" SET email_verified=true WHERE id=\'other\'')
    const accepted = await invited.post('/api/organizations/accept-invitation', {
      data: { invitationId: `invite-${first.id}` }
    })
    expect(accepted.ok(), await accepted.text()).toBeTruthy()
    expect(
      (
        await invited.post('/api/organizations/accept-invitation', { data: { invitationId: `invite-${second.id}` } })
      ).status()
    ).toBe(409)
    expect(
      (
        await invited.post('/api/auth/organization/accept-invitation', {
          data: { invitationId: `invite-${second.id}` }
        })
      ).status()
    ).toBe(409)
    await invited.post('/api/auth/organization/set-active', { data: { organizationId: first.id } })
    expect(
      (
        await invited.post('/api/auth/organization/update', {
          data: { organizationId: first.id, data: { name: 'Bypass' } }
        })
      ).status()
    ).toBe(403)
    const membership = (await db.query('SELECT id FROM member WHERE organization_id=$1', [first.id])).rows[0]
    expect(
      (await invited.patch(`/api/clients/${first.id}/members/${membership.id}`, { data: { role: 'admin' } })).status()
    ).toBe(403)
    expect(
      (await coach.patch(`/api/clients/${first.id}/members/${membership.id}`, { data: { role: 'admin' } })).status()
    ).toBe(403)
    expect((await invited.patch(`/api/clients/${first.id}`, { data: { timezone: 'Asia/Tokyo' } })).ok()).toBeTruthy()
    const timezone = await (await invited.get('/api/timezones')).json()
    expect(timezone.schedulingTimezone).toBe('Asia/Tokyo')
    await coach.patch(`/api/clients/${first.id}/archive`, { data: { archived: true } })
    const selectable = await (await coach.get('/api/clients/selectable')).json()
    expect(selectable.some((client: { id: string }) => client.id === first.id)).toBe(false)
  } finally {
    await db.query('UPDATE "user" SET email_verified=true WHERE id=\'other\'')
    await db.end()
    await coach.dispose()
    await invited.dispose()
  }
})

test('coach can create a private client with inherited timezone and filter the list', async ({ page }) => {
  await login(page.request, 'coach@example.test')
  await page.request.post('/api/auth/organization/set-active', { data: { organizationId: 'provider' } })
  await page.goto('/clients')
  await page.getByRole('button', { name: 'New client', exact: true }).click()
  await page.locator('form').getByLabel('Client type', { exact: true }).click()
  await page.getByRole('option', { name: 'Private person', exact: true }).click()
  await page.getByLabel('Full name', { exact: true }).fill('Private client from form')
  await expect(page.getByText('VAT number', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Inherit (Europe/Amsterdam)', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Create client', exact: true }).click()
  await expect(page).toHaveURL(/\/clients\/[^?]+/, { timeout: 20000 })
  await expect(page.getByRole('heading', { name: 'Private client from form', exact: true })).toBeVisible()
  await page.goto('/clients?clientType=person')
  await expect(page.getByText('Private client from form', { exact: true }).first()).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'test-results/personal-clients/mobile-clients.png', fullPage: true })
})

test('private signup preserves the email-verification flow and onboarding destination', async ({ page }) => {
  let signInOtpRequests = 0
  await page.route('**/api/auth/sign-up/email', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: null,
        user: { id: 'signup-fixture', name: 'New Person', email: 'signup@example.test', emailVerified: false }
      })
    })
  )
  await page.route('**/api/auth/email-otp/send-verification-otp', (route) => {
    if (route.request().postDataJSON()?.type === 'sign-in') {
      signInOtpRequests++
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' })
  })
  await page.goto('/signup')
  await page.getByLabel('First name', { exact: true }).fill('New')
  await page.getByLabel('Last name', { exact: true }).fill('Person')
  await page.getByLabel('Email', { exact: true }).fill('signup@example.test')
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page).toHaveURL(/\/verify-email\?.*purpose=personal/)
  expect(new URL(page.url()).searchParams.get('redirect')).toBe('/personal-onboarding')
  await expect(page.getByText('Verification Code', { exact: true })).toBeVisible()
  expect(signInOtpRequests).toBe(0)
})
