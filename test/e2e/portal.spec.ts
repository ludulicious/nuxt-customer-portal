import { expect, test, type Response as PlaywrightResponse } from '@playwright/test'
import { defaultPortalSettings } from '../../packages/saas-configuration/shared/settings'
import { Pool } from 'pg'
import sharp from 'sharp'
import { randomBytes } from 'node:crypto'
import { PROFILE_IMAGE_INPUT_LIMIT, PROFILE_IMAGE_STORED_LIMIT } from '../../packages/core/shared/profile-image'

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: 'cookie-consent', value: 'accepted', url: baseURL! }])
})

test('normal portal supports sign-in and onboarding without demo access', async ({ page }, info) => {
  test.skip(info.project.name.startsWith('demo'))
  await page.goto('/login')
  await expect(page.locator('form')).toBeVisible()
  await expect(page.locator('[data-demo-banner]')).toHaveCount(0)
  await page.getByRole('textbox', { name: /^Email/ }).fill('owner@example.test')
  await page.getByLabel(/^Password/).fill('Portal-e2e-password-2026!')
  await page.locator('form button[type=submit]').click()
  await expect(page).toHaveURL(/\/(onboarding|dashboard)$/)
  const bootstrap = await (await page.request.get('/api/portal/bootstrap')).json()
  if (!bootstrap.completed) {
    await expect(page.locator('form')).toBeVisible()
    const complete = await page.request.post('/api/admin/portal-settings/complete', {
      data: { settings: defaultPortalSettings('Test Portal') }
    })
    expect(complete.ok(), await complete.text()).toBeTruthy()
    await page.goto('/dashboard')
  }
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.locator('main')).toBeVisible()
  expect((await page.request.get('/api/demo/users')).status()).toBe(404)
  expect((await page.request.post('/api/demo/switch', { data: { userId: 'demo-admin' } })).status()).toBe(404)
  await page.goto('/admin/portal-settings')
  await expect(page.locator('form')).toBeVisible()
  await expect(page.locator('form button[type=submit]')).toBeEnabled()
  await page.getByRole('textbox', { name: /^Portal name/ }).fill('Test Portal Verified')
  const saved = page.waitForResponse(
    (response) => response.url().endsWith('/api/admin/portal-settings') && response.request().method() === 'PUT'
  )
  await page.locator('form button[type=submit]').click()
  expect((await saved).status()).toBe(200)
  await page.reload()
  await expect(page.getByRole('textbox', { name: /^Portal name/ })).toHaveValue('Test Portal Verified')
  await page.screenshot({ path: info.outputPath('normal-settings.png'), fullPage: true })
})

test('demo exposes seeded workflows, role switching and read-only settings', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('demo'))
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.locator('[data-demo-banner]')).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Explore as' })).toBeVisible()
  await page.goto('/login')
  await expect(page).toHaveURL(/\/dashboard$/)
  expect((await (await page.request.get('/api/portal/bootstrap')).json()).completed).toBe(true)
  for (const path of [
    '/admin/timesheets',
    '/admin/invoices',
    '/admin/requests',
    '/admin/products',
    '/admin/planning'
  ]) {
    await page.goto(path)
    await expect(page).toHaveURL(new RegExp(path + '$'))
    await expect(page.locator('main')).toBeVisible()
    await expect(page.getByText('500', { exact: true })).toHaveCount(0)
  }
  await page.goto('/admin/portal-settings')
  await expect(page.getByText('Demo settings are read-only.', { exact: false })).toBeVisible()
  await expect(page.locator('form button[type=submit]')).toBeDisabled()
  await expect(page.getByRole('textbox', { name: /^Portal name/ })).toBeDisabled()
  const rejected = await page.request.put('/api/admin/portal-settings', { data: {} })
  expect(rejected.status()).toBe(403)
  expect((await rejected.json()).data.code).toBe('DEMO_RESTRICTED')
  await page.screenshot({ path: info.outputPath('demo-settings.png'), fullPage: true })
  const identities = await (await page.request.get('/api/demo/users')).json()
  expect(identities).toHaveLength(7)
  for (const identity of identities) {
    expect((await page.request.post('/api/demo/switch', { data: { userId: identity.id } })).ok()).toBeTruthy()
    const session = await (await page.request.get('/api/auth/get-session')).json()
    expect(session.user.id).toBe(identity.id)
  }
  await page.goto('/dashboard')
  await expect(page.locator('[data-demo-banner]')).toBeVisible()
  await page.getByRole('combobox', { name: 'Explore as' }).click()
  await page.getByRole('option').filter({ hasText: 'Alex Morgan' }).click()
  await expect(page.getByRole('combobox', { name: 'Explore as' })).toContainText('Alex Morgan')
  await page.screenshot({ path: info.outputPath('demo-dashboard.png'), fullPage: true })
  expect(errors).toEqual([])
})

test('profile images stay small through startup, uploads, profile edits and removal', async ({
  page,
  baseURL
}, info) => {
  test.skip(info.project.name.startsWith('demo'))
  const databaseUrl = process.env.E2E_DATABASE_URL!
  expect(new URL(databaseUrl).pathname).toMatch(/^\/portal_[a-z0-9_]+_e2e$/)
  const pool = new Pool({ connectionString: databaseUrl })
  const authHeaders = {
    origin: baseURL!,
    'x-forwarded-for': info.project.name === 'portal-mobile' ? '192.0.2.42' : '192.0.2.41'
  }
  try {
    const original = await sharp(randomBytes(640 * 640 * 3), { raw: { width: 640, height: 640, channels: 3 } })
      .png()
      .toBuffer()
    const legacyImage = `data:image/png;base64,${original.toString('base64')}`
    const seeded = await pool.query(
      'update "user" set name=$1, first_name=$2, last_name=$3, image=$4 where email=$5 returning id',
      ['Portal Owner', 'Portal', 'Owner', legacyImage, 'owner@example.test']
    )
    const userId = seeded.rows[0].id
    const signedIn = await page.request.post('/api/auth/sign-in/email', {
      headers: authHeaders,
      data: { email: 'owner@example.test', password: 'Portal-e2e-password-2026!' }
    })
    expect(signedIn.ok(), await signedIn.text()).toBeTruthy()
    // An established workspace avoids the expected extra session refresh when
    // the portal automatically selects an organization for a new session.
    const organizations = await (await page.request.get('/api/auth/organization/list')).json()
    const active = await page.request.post('/api/auth/organization/set-active', {
      headers: authHeaders,
      data: { organizationId: organizations[0].id }
    })
    expect(active.ok(), await active.text()).toBeTruthy()
    const state = await (await page.request.get('/api/portal/bootstrap')).json()
    if (!state.completed) {
      const complete = await page.request.post('/api/admin/portal-settings/complete', {
        data: { settings: defaultPortalSettings('Test Portal') }
      })
      expect(complete.ok(), await complete.text()).toBeTruthy()
    }
    const sessions: PlaywrightResponse[] = []
    const privateProxyRequests: string[] = []
    page.on('response', (response) => {
      if (new URL(response.url()).pathname === '/api/auth/get-session') {
        sessions.push(response)
      }
      if (response.url().includes('/_ipx/') && response.url().includes('/api/portal/images/')) {
        privateProxyRequests.push(response.url())
      }
    })
    await page.goto('/dashboard')
    await expect(page.locator('main')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Welcome back, Portal Owner' })).toBeVisible()
    expect(sessions).toHaveLength(1)
    const initial = await sessions[0]!.json()
    expect(JSON.stringify(initial).length).toBeLessThan(4000)
    expect(initial.user.image).toContain(`/api/portal/images/user/${userId}/avatar?v=`)
    expect(new URL(initial.user.image).origin).toBe(new URL(info.project.use.baseURL!).origin)
    await expect(page.locator(`img[src="${initial.user.image}"]`).first()).toHaveJSProperty('naturalWidth', 96)
    expect(privateProxyRequests).toEqual([])
    await page.goto('/settings')
    const form = page.locator('form').filter({ has: page.locator('input[type=file]') })
    await expect(form).toBeVisible()
    await form.locator('input[type=file]').setInputFiles({
      name: 'oversized.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(PROFILE_IMAGE_INPUT_LIMIT + 1)
    })
    await expect(form.getByText('Choose an image smaller than 5 MB')).toBeVisible()
    await form
      .locator('input[type=file]')
      .setInputFiles({ name: 'portrait.png', mimeType: 'image/png', buffer: original })
    const save = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/profile' && response.request().method() === 'PATCH'
    )
    await form.locator('button[type=submit]').click()
    expect((await save).status()).toBe(200)
    const stored = (await pool.query('select image from "user" where id=$1', [userId])).rows[0].image as string
    expect(stored).toMatch(/^data:image\/webp;base64,/)
    expect(Buffer.from(stored.split(',')[1]!, 'base64').length).toBeLessThanOrEqual(PROFILE_IMAGE_STORED_LIMIT)
    await form.getByRole('textbox', { name: /^Display Name/i }).fill('Portal Owner edited')
    const edited = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/profile' && response.request().method() === 'PATCH'
    )
    await form.locator('button[type=submit]').click()
    expect((await edited).status()).toBe(200)
    expect((await pool.query('select image from "user" where id=$1', [userId])).rows[0].image).toBe(stored)
    const invalid = await page.request.patch('/api/profile', { data: { image: 'data:image/png;base64,AAAA' } })
    expect(invalid.status()).toBe(400)
    expect((await invalid.json()).data.code).toBe('PROFILE_IMAGE_INVALID')
    const authUpdate = await page.request.post('/api/auth/update-user', {
      headers: authHeaders,
      data: { image: legacyImage }
    })
    expect(authUpdate.ok(), await authUpdate.text()).toBeTruthy()
    const afterAuthUpdate = (await pool.query('select image from "user" where id=$1', [userId])).rows[0].image as string
    expect(Buffer.from(afterAuthUpdate.split(',')[1]!, 'base64').length).toBeLessThanOrEqual(PROFILE_IMAGE_STORED_LIMIT)
    const current = await (await page.request.get('/api/auth/get-session')).json()
    const roundTrip = await page.request.post('/api/auth/update-user', {
      headers: authHeaders,
      data: { image: current.user.image }
    })
    expect(roundTrip.ok(), await roundTrip.text()).toBeTruthy()
    expect((await pool.query('select image from "user" where id=$1', [userId])).rows[0].image).toBe(afterAuthUpdate)
    const profileRoundTrip = await page.request.patch('/api/profile', { data: { image: current.user.image } })
    expect(profileRoundTrip.ok(), await profileRoundTrip.text()).toBeTruthy()
    expect((await pool.query('select image from "user" where id=$1', [userId])).rows[0].image).toBe(afterAuthUpdate)
    const removed = await page.request.patch('/api/profile', { data: { image: null } })
    expect(removed.ok(), await removed.text()).toBeTruthy()
    expect((await removed.json()).user.image).toBeNull()
    expect((await pool.query('select image from "user" where id=$1', [userId])).rows[0].image).toBeNull()
  } finally {
    await pool.end()
  }
})

test('approval cards load summaries alongside periods and fetch time details on demand', async ({
  page,
  baseURL
}, info) => {
  test.skip(info.project.name.startsWith('demo'))
  const signedIn = await page.request.post('/api/auth/sign-in/email', {
    headers: {
      origin: baseURL!,
      'x-forwarded-for': info.project.name === 'portal-mobile' ? '192.0.2.52' : '192.0.2.51'
    },
    data: { email: 'owner@example.test', password: 'Portal-e2e-password-2026!' }
  })
  expect(signedIn.ok(), await signedIn.text()).toBeTruthy()
  const organizations = await (await page.request.get('/api/auth/organization/list')).json()
  expect(
    (
      await page.request.post('/api/auth/organization/set-active', {
        headers: { origin: baseURL! },
        data: { organizationId: organizations[0].id }
      })
    ).ok()
  ).toBeTruthy()
  const request = {
    id: 'performance-request',
    workspaceClientId: 'performance-link',
    clientName: 'Performance client',
    supplierName: 'Test Portal',
    startsOn: '2020-01-01',
    endsOn: '2020-01-31',
    revision: 1,
    status: 'PENDING',
    version: 1,
    supplementary: false,
    replacesId: null,
    replacesIds: [],
    message: null,
    totalMinutes: 120,
    people: ['Test person'],
    submissions: [],
    reviewerUserId: null,
    reviewedAt: null
  }
  let releaseSummary!: () => void
  const periodsStarted = new Promise<void>((resolve) => {
    releaseSummary = resolve
  })
  let summaryCalls = 0
  let detailCalls = 0
  await page.route('**/api/timesheets/admin/review-periods?**', async (route) => {
    releaseSummary()
    await route.fulfill({ json: { periods: [], startsOn: '2020-01-01' } })
  })
  await page.route('**/api/timesheets/admin/review-requests?**', async (route) => {
    const url = new URL(route.request().url())
    expect(url.searchParams.get('summary')).toBe('true')
    expect(url.searchParams.get('month')).toBe('2020-01')
    summaryCalls++
    // A sequential implementation cannot render the cards until this barrier releases.
    await periodsStarted
    await route.fulfill({ json: [request] })
  })
  await page.route('**/api/timesheets/admin/review-requests/performance-request', async (route) => {
    detailCalls++
    await route.fulfill({
      json: {
        ...request,
        entries: [
          {
            id: 'entry',
            date: '2020-01-06',
            weekStartsOn: '2020-01-06',
            personId: 'person',
            person: 'Test person',
            project: 'Test project',
            activity: 'Work',
            minutes: 120,
            note: 'Loaded on demand',
            submissionId: 'submission'
          }
        ],
        history: [
          {
            action: 'SENT',
            actor: 'Portal Owner',
            actorId: 'owner',
            comment: 'Review these hours',
            createdAt: '2020-02-01'
          }
        ]
      }
    })
  })
  await page.goto('/timesheets/client-approvals?reviewMonth=2020-01')
  await expect(page.getByRole('heading', { name: 'Performance client', exact: true })).toBeVisible()
  expect(summaryCalls).toBe(1)
  expect(detailCalls).toBe(0)
  await page.getByRole('button', { name: 'View details', exact: true }).click()
  await expect(page.getByRole('dialog').getByText('Loaded on demand')).toBeVisible()
  await expect(page.getByRole('dialog').getByText('Review these hours')).toBeVisible()
  expect(detailCalls).toBe(1)
  await page.goto('/timesheets/client-approvals?request=performance-request')
  await expect(page.getByRole('dialog').getByText('Loaded on demand')).toBeVisible()
  await expect(page).toHaveURL(/reviewMonth=2020-01/)
})

test('startup branding is compact while originals remain editable', async ({ page, baseURL }, info) => {
  test.skip(info.project.name.startsWith('demo'))
  const pool = new Pool({ connectionString: process.env.E2E_DATABASE_URL! })
  const signedIn = await page.request.post('/api/auth/sign-in/email', {
    headers: {
      origin: baseURL!,
      'x-forwarded-for': info.project.name === 'portal-mobile' ? '192.0.2.62' : '192.0.2.61'
    },
    data: { email: 'owner@example.test', password: 'Portal-e2e-password-2026!' }
  })
  expect(signedIn.ok(), await signedIn.text()).toBeTruthy()
  const organizations = await (await page.request.get('/api/auth/organization/list')).json()
  const organizationId = organizations[0].id
  expect(
    (
      await page.request.post('/api/auth/organization/set-active', {
        headers: { origin: baseURL! },
        data: { organizationId }
      })
    ).ok()
  ).toBeTruthy()
  const saved = await (await page.request.get('/api/admin/portal-settings')).json()
  const original = (await pool.query('select logo, metadata from organization where id=$1', [organizationId])).rows[0]
  try {
    const image =
      'data:image/png;base64,' +
      (
        await sharp(randomBytes(640 * 640 * 3), { raw: { width: 640, height: 640, channels: 3 } })
          .png()
          .toBuffer()
      ).toString('base64')
    await pool.query('update organization set logo=$1, metadata=$2 where id=$3', [
      image,
      JSON.stringify({ avatarLogo: image }),
      organizationId
    ])
    const settings = structuredClone(saved.settings)
    settings.appearance.headerBranding = 'full-logo'
    settings.branding.logoLight = image
    settings.branding.markLight = image
    const update = await page.request.put('/api/admin/portal-settings', { data: { settings } })
    expect(update.ok(), await update.text()).toBeTruthy()
    const publicResponse = await page.request.get('/api/portal/public')
    const publicText = await publicResponse.text()
    expect(publicText.length).toBeLessThan(20_000)
    expect(publicText).not.toContain('data:image/')
    const branding = JSON.parse(publicText).branding
    const logo = await page.request.get(branding.logoLight)
    expect(logo.ok()).toBeTruthy()
    expect(logo.headers()['cache-control']).toContain('public,')
    expect((await sharp(await logo.body()).metadata()).width).toBe(512)
    const mark = await page.request.get(branding.markLight)
    expect((await sharp(await mark.body()).metadata()).width).toBe(96)
    const listed = await (await page.request.get('/api/auth/organization/list')).json()
    expect(JSON.stringify(listed).length).toBeLessThan(5000)
    expect(JSON.stringify(listed)).not.toContain('data:image/')
    const permissions = await (await page.request.get('/api/auth/permissions')).json()
    expect(JSON.stringify(permissions).length).toBeLessThan(15_000)
    expect(JSON.stringify(permissions)).not.toContain('data:image/')
    const privateLogo = await page.request.get(permissions.activeOrganization.logo)
    expect(privateLogo.ok()).toBeTruthy()
    expect(privateLogo.headers()['cache-control']).toContain('private,')
    expect((await sharp(await privateLogo.body()).metadata()).width).toBe(512)
    expect((await (await page.request.get('/api/admin/portal-settings')).json()).settings.branding.logoLight).toBe(
      image
    )
    expect((await pool.query('select logo from organization where id=$1', [organizationId])).rows[0].logo).toBe(image)
    await page.goto('/dashboard')
    await expect(page.locator(`img[src="${branding.logoLight}"]`).first()).toHaveJSProperty('naturalWidth', 512)
  } finally {
    await pool.query('update organization set logo=$1, metadata=$2 where id=$3', [
      original.logo,
      original.metadata,
      organizationId
    ])
    await page.request.put('/api/admin/portal-settings', { data: { settings: saved.settings } })
    await pool.end()
  }
})
