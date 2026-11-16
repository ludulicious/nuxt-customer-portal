import assert from 'node:assert/strict'
import test from 'node:test'
import { organizationImageUrls, organizationListImageResponse } from '../server/utils/organization-images'

const image = 'data:image/png;base64,' + 'A'.repeat(300_000)

test('organization display responses replace embedded branding and preserve editing originals and metadata', () => {
  const organization = {
    id: 'org/one',
    name: 'Organization',
    logo: image,
    metadata: JSON.stringify({ avatarLogo: image, officialCompanyName: 'Company', nested: { keep: true } })
  }
  const original = JSON.stringify(organization)
  const display = organizationImageUrls(organization, 'https://portal.example.test')
  assert.ok(JSON.stringify(display).length < 600)
  assert.match(display.logo!, /^https:\/\/portal.example.test\/api\/portal\/images\/organization\/org%2Fone\/logo\?v=/)
  assert.match(JSON.parse(display.metadata!).avatarLogo, /\/avatar\?v=/)
  assert.equal(JSON.parse(display.metadata!).officialCompanyName, 'Company')
  assert.deepEqual(JSON.parse(display.metadata!).nested, { keep: true })
  assert.equal(JSON.stringify(organization), original)
  assert.notEqual(organizationImageUrls({ ...organization, logo: image + 'A' }).logo, display.logo)
  assert.equal(
    organizationImageUrls({ id: 'one', logo: 'https://example.test/logo.png', metadata: 'invalid' }).metadata,
    'invalid'
  )
  assert.equal(
    organizationImageUrls({ id: 'one', logo: 'https://example.test/logo.png' }).logo,
    'https://example.test/logo.png'
  )
})

test('Better Auth organization list keeps cookies and status while dropping stale body headers', async () => {
  const headers = new Headers({
    'content-length': String(image.length),
    'content-encoding': 'gzip',
    etag: 'original',
    'x-test': 'keep'
  })
  headers.append('set-cookie', 'one=1; Path=/; HttpOnly')
  headers.append('set-cookie', 'two=2; Path=/; HttpOnly')
  const result = await organizationListImageResponse(
    new Response(JSON.stringify([{ id: 'one', logo: image }]), { headers })
  )
  assert.equal(result.status, 200)
  assert.equal(result.headers.get('content-length'), null)
  assert.equal(result.headers.get('content-encoding'), null)
  assert.equal(result.headers.get('etag'), null)
  assert.equal(result.headers.get('x-test'), 'keep')
  assert.equal(result.headers.getSetCookie().length, 2)
  assert.ok((await result.text()).length < 400)
  const error = new Response('{"error":"unauthorized"}', { status: 401 })
  assert.strictEqual(await organizationListImageResponse(error), error)
  assert.equal(await error.text(), '{"error":"unauthorized"}')
})
