import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { documentationDefaults } from '../../shared/documentation'

test('offers actionable, source-pinned documentation feedback', async ({ page }) => {
  await page.goto('/architecture/layers', { waitUntil: 'networkidle' })

  await expect(page.getByRole('heading', { name: 'Help improve this page' })).toBeVisible()

  const reportLink = page.getByRole('link', { name: 'Report a docs issue' })
  const reportHref = await reportLink.getAttribute('href')
  expect(reportHref).toBeTruthy()

  const reportUrl = new URL(reportHref!)
  expect(`${reportUrl.origin}${reportUrl.pathname}`).toBe(`${documentationDefaults.feedbackRepositoryUrl}/issues/new`)
  expect(reportUrl.searchParams.get('title')).toBe('Docs: Nuxt layers')
  expect(reportUrl.searchParams.get('body')).toContain('https://nuxt-customer-portal.com/architecture/layers')
  expect(reportUrl.searchParams.get('body')).toContain(documentationDefaults.productSourceCommit)

  await expect(page.getByRole('link', { name: 'Edit this page' })).toHaveAttribute(
    'href',
    `${documentationDefaults.docsRepositoryUrl}/edit/${documentationDefaults.docsRepositoryBranch}/apps/docs/content/2.architecture/2.layers.md`
  )
  await expect(page.getByRole('link', { name: documentationDefaults.productSourceCommit.slice(0, 7) })).toHaveAttribute(
    'href',
    `${documentationDefaults.productRepositoryUrl}/commit/${documentationDefaults.productSourceCommit}`
  )

  const accessibility = await new AxeBuilder({ page }).analyze()
  expect(accessibility.violations).toEqual([])
})

test('serves the repository-authored Markdown source', async ({ request }) => {
  const response = await request.get('/raw/modules/overview.md')
  const source = await response.text()
  const llmsIndex = await request.get('/llms.txt')

  expect(response.ok()).toBe(true)
  expect(response.headers()['content-type']).toContain('text/markdown')
  expect(source).toContain('githubPath: apps/docs/content/3.modules/1.overview.md')
  expect(source).toContain('| Package | Responsibility |')
  expect(source).not.toContain('<table>')
  expect(llmsIndex.ok()).toBe(true)
  expect(await llmsIndex.text()).toContain('https://nuxt-customer-portal.com/raw/modules/overview.md')
})

test('feature-layer contributor journey reaches an honest distribution contract', async ({ page }) => {
  await page.goto('/contributing/create-a-layer')

  await expect(page.getByRole('heading', { level: 1, name: 'Create a feature layer' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Define the feature' })).toBeVisible()
  await expect(page.getByText('PortalFeatureDefinition<NoteAction>', { exact: false }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Distribute a feature layer' }).last()).toHaveAttribute(
    'href',
    '/contributing/distribute-a-layer'
  )

  await page.goto('/contributing/distribute-a-layer')

  await expect(page.getByRole('heading', { level: 1, name: 'Distribute a feature layer' })).toBeVisible()
  await expect(page.getByText('Official layers use Nuxt\'s npm-layer model', { exact: false })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Package contract' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Edit this page' })).toHaveAttribute(
    'href',
    `${documentationDefaults.docsRepositoryUrl}/edit/${documentationDefaults.docsRepositoryBranch}/apps/docs/content/7.contributing/3.distribute-a-layer.md`
  )

  const accessibility = await new AxeBuilder({ page }).analyze()
  expect(accessibility.violations).toEqual([])
})

test('product source map connects contributor terms to immutable implementations', async ({ page }) => {
  await page.goto('/reference/source-map')

  await expect(page.getByRole('heading', { level: 1, name: 'Product source map' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'packages/core/shared/types/feature.ts' }).first()).toHaveAttribute(
    'href',
    `${documentationDefaults.productRepositoryUrl}/blob/${documentationDefaults.productSourceCommit}/packages/core/shared/types/feature.ts`
  )
  await expect(page.getByRole('link', { name: 'glossary' }).last()).toHaveAttribute('href', '/reference/glossary')

  let accessibility = await new AxeBuilder({ page }).analyze()
  expect(accessibility.violations).toEqual([])

  await page.setViewportSize({ width: 375, height: 812 })
  const sourceMapWidth = await page.evaluate(() => ({
    viewport: window.innerWidth,
    content: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth)
  }))
  expect(sourceMapWidth.content).toBeLessThanOrEqual(sourceMapWidth.viewport)

  await page.goto('/reference/glossary')

  await expect(page.getByRole('heading', { level: 1, name: 'Glossary' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 3, name: 'Feature layer' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 3, name: 'Active organization' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'source map' }).last()).toHaveAttribute('href', '/reference/source-map')

  accessibility = await new AxeBuilder({ page }).analyze()
  expect(accessibility.violations).toEqual([])
})

test('platform catalog explains ownership and the pinned API surface', async ({ page }) => {
  await page.goto('/modules/platform-layers')

  await expect(page.getByRole('heading', { level: 1, name: 'Platform layers' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Decide where a change belongs' })).toBeVisible()
  for (const layer of ['core', 'ui', 'authentication', 'organizations', 'clients', 'preset', 'kit']) {
    await expect(page.getByText(layer, { exact: true }).first()).toBeVisible()
  }
  await expect(page.getByRole('link', { name: 'Create a feature layer' }).last()).toHaveAttribute(
    'href',
    '/contributing/create-a-layer'
  )

  let accessibility = await new AxeBuilder({ page }).analyze()
  expect(accessibility.violations).toEqual([])

  await page.goto('/reference/server-api')
  await expect(page.getByRole('heading', { level: 2, name: 'Current product surface' })).toBeVisible()
  await expect(page.getByText('contains 117 Nitro API handler files', { exact: false })).toBeVisible()
  await expect(page.getByRole('row', { name: /timesheets 51/ })).toBeVisible()

  await page.setViewportSize({ width: 375, height: 812 })
  const apiReferenceWidth = await page.evaluate(() => ({
    viewport: window.innerWidth,
    content: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth)
  }))
  expect(apiReferenceWidth.content).toBeLessThanOrEqual(apiReferenceWidth.viewport)

  accessibility = await new AxeBuilder({ page }).analyze()
  expect(accessibility.violations).toEqual([])
})

test('configuration journey exposes the required production auth secret', async ({ page }) => {
  await page.goto('/reference/configuration')

  await expect(page.getByRole('heading', { level: 1, name: 'Configuration reference' })).toBeVisible()
  await expect(page.getByText('Generate BETTER_AUTH_SECRET with', { exact: false })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Runtime variables' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Better Auth secret reference' })).toHaveAttribute(
    'href',
    'https://better-auth.com/docs/reference/options#secret'
  )

  await page.goto('/getting-started/installation')
  await expect(page.getByText('openssl rand -base64 32', { exact: false }).first()).toBeVisible()
  await expect(page.getByText('BETTER_AUTH_SECRET=<paste-the-generated-secret>', { exact: false }).first()).toBeVisible()

  await page.setViewportSize({ width: 375, height: 812 })
  const installationWidth = await page.evaluate(() => ({
    viewport: window.innerWidth,
    content: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth)
  }))
  expect(installationWidth.content).toBeLessThanOrEqual(installationWidth.viewport)

  const accessibility = await new AxeBuilder({ page }).analyze()
  expect(accessibility.violations).toEqual([])
})
