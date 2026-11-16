import assert from 'node:assert/strict'
import test from 'node:test'
import { clientSummary } from '../server/utils/client-summary'

const image = 'data:image/png;base64,' + 'A'.repeat(1_205_646)
const client = {
  organizationId: 'client',
  name: 'Client',
  slug: 'client',
  logo: image,
  metadata: null,
  clientType: 'organization' as 'organization' | 'person',
  firstName: null,
  lastName: null,
  timezone: null,
  officialName: 'Client Company',
  address: 'Main Street',
  registrationNumber: null,
  vatNumber: null,
  invoiceEmail: 'client@example.test',
  preferredLocale: 'nl',
  archivedAt: null,
  members: [{ image }],
  invitations: [{ email: 'private@example.test' }]
}

test('client summaries omit member graphs and inline images while preserving list and billing fields', () => {
  const result = clientSummary(client, 'Europe/Amsterdam', [{ moduleId: 'timesheets', enabled: true }])
  assert.ok(JSON.stringify(result).length < 1200)
  assert.equal('members' in result, false)
  assert.equal('invitations' in result, false)
  assert.equal('metadata' in result, false)
  assert.match(result.logo!, /^\/api\/portal\/images\/organization\/client\/logo\?v=/)
  assert.match(result.avatarLogo!, /\/avatar\?v=/)
  assert.equal(result.schedulingTimezone, 'Europe/Amsterdam')
  assert.equal(result.address, client.address)
  assert.equal(result.invoiceEmail, client.invoiceEmail)
  assert.deepEqual(result.modules, [{ moduleId: 'timesheets', enabled: true }])
})

test('personal summaries preserve owner avatar, name and organization fallbacks', () => {
  const person = { ...client, clientType: 'person' as const }
  const owner = { userId: 'owner', image, firstName: 'Alice', lastName: 'Example' }
  const result = clientSummary(person, 'Europe/Amsterdam', [], owner)
  assert.match(result.avatarLogo!, /\/user\/owner\/avatar/)
  assert.equal(result.firstName, 'Alice')
  assert.equal(result.lastName, 'Example')
  const fallback = clientSummary(
    { ...person, metadata: '{"avatarLogo":"https://example.test/avatar.png"}' },
    'UTC',
    [],
    { ...owner, image: null }
  )
  assert.equal(fallback.avatarLogo, 'https://example.test/avatar.png')
})
