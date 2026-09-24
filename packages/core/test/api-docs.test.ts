import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('configures the SaaS portal OpenAPI documentation interfaces', async () => {
  const config = await readFile(new URL('../../../apps/saas-portal/nuxt.config.ts', import.meta.url), 'utf8')

  assert.match(config, /route: '\/api-docs\/openapi\.raw\.json'/)
  assert.match(config, /scalar:\s*{[\s\S]*?route: '\/api-docs'/)
  assert.match(config, /spec:\s*{[\s\S]*?url: '\/api-docs\/openapi\.json'/)
  assert.match(config, /swagger:\s*{[\s\S]*?route: '\/api-docs\/swagger'/)
})

test('assembles the ordered document through an authenticated local request', async () => {
  const route = await readFile(new URL('../server/routes/api-docs/openapi.json.get.ts', import.meta.url), 'utf8')

  assert.match(route, /event\.\$fetch<OpenApiDocument>\('\/api-docs\/openapi\.raw\.json'\)/)
  assert.doesNotMatch(route, /getRequestURL/)
  assert.match(route, /orderOpenApiDocument\(enrichOpenApiContracts\(mergeBetterAuthOpenApi\(/)
})
