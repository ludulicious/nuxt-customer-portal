import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

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
  assert.match(list, /<NuxtLink :to="clientDetailTo\(client\)"/)
  assert.doesNotMatch(list, /editingId/)
  assert.match(detailPage, /features\.clients\.backToClients/)
  assert.match(detailPage, /value\.startsWith\('\/clients\?'\)/)
  assert.match(detailComponent, /<ClientsClientForm v-if="editing"/)
  assert.match(detailComponent, /features\.clients\.pendingInvitations/)
  assert.match(detailComponent, /integration\.detailComponent/)
})
