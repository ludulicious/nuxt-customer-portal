import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { genericClientListQuerySchema } from '../server/utils/client-validation'

const listUrl = new URL('../app/pages/clients/index.vue', import.meta.url)
const detailPageUrl = new URL('../app/pages/clients/[id].vue', import.meta.url)
const detailComponentUrl = new URL('../app/components/ClientsClientDetail.vue', import.meta.url)

test('client cards open a dedicated detail route and preserve collection state', async () => {
  const [list, detailPage, detailComponent] = await Promise.all([
    readFile(listUrl, 'utf8'),
    readFile(detailPageUrl, 'utf8'),
    readFile(detailComponentUrl, 'utf8')
  ])

  assert.match(list, /path: `\/clients\/\$\{client\.id\}`/)
  assert.match(list, /query: \{ returnTo: listReturnPath\.value \}/)
  assert.match(list, /scroll: String\(Math\.round\(listScrollTop\.value\)\)/)
  assert.match(list, /<NuxtLink\s+:to="clientDetailTo\(client\)"/)
  assert.match(list, /t\('features\.clients\.resultCount', result\.pagination\.totalItems\)/)
  assert.match(list, /<UPagination\s+v-if="result\.pagination\.totalPages > 1"/)
  assert.match(list, /i-lucide-refresh-cw/)
  assert.match(list, /:aria-label="t\('common\.refresh'\)"/)
  assert.match(list, /hidden text-sm text-muted sm:block/)
  assert.match(list, /rounded-full sm:hidden/)
  assert.match(list, /:aria-label="t\('features\.clients\.new'\)"/)
  assert.match(list, /:aria-label="t\('common\.filters'\)"/)
  assert.match(list, /:aria-label="t\('common\.sort'\)"/)
  assert.match(list, /<UModal\s+v-model:open="showFilters"/)
  assert.match(list, /<UModal\s+v-model:open="showSort"/)
  assert.doesNotMatch(list, /editingId/)
  assert.match(detailPage, /features\.clients\.backToClients/)
  assert.match(detailPage, /value\.startsWith\('\/clients\?'\)/)
  assert.match(detailComponent, /<ClientsClientForm\s+v-if="editing"/)
  assert.match(detailComponent, /features\.clients\.pendingInvitations/)
  assert.match(detailComponent, /integration\.detailComponent/)
})

test('client status filters support a default active view and a durable all view', async () => {
  const list = await readFile(listUrl, 'utf8')

  assert.match(list, /route\.query\.status === 'all' \? 'all' : 'active'/)
  assert.match(list, /status\.value !== 'active'/)
  assert.match(list, /status: status\.value === 'all' \? undefined : status\.value/)
  assert.equal(genericClientListQuerySchema.parse({ status: 'all' }).status, 'all')
  assert.equal(genericClientListQuerySchema.parse({ status: 'active' }).status, 'active')
  assert.equal(genericClientListQuerySchema.parse({ status: 'archived' }).status, 'archived')
})
