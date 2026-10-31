import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { computed, effectScope, nextTick, onScopeDispose, reactive, readonly, ref, watch } from 'vue'
import ts from 'typescript'
import { invoiceListReturnTo, parseInvoiceListPosition } from '../shared/invoice-list-navigation'

const transpile = (source: string) =>
  ts.transpileModule(source.replaceAll('import.meta.client', 'true'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
const resourceSource = transpile(
  readFileSync(new URL('../../core/app/composables/usePaginatedResource.ts', import.meta.url), 'utf8')
)
const listSource = transpile(
  readFileSync(new URL('../app/composables/useInvoicesAdminList.ts', import.meta.url), 'utf8')
)
const reactivity = { ref, reactive, computed, readonly, watch, onScopeDispose }
const resourceExports = {} as typeof import('../../core/app/composables/usePaginatedResource')
runInNewContext(resourceSource, { exports: resourceExports, ...reactivity, AbortController, Error })
const flush = async () => {
  await nextTick()
  await new Promise<void>((resolve) => setImmediate(resolve))
  await nextTick()
}

function harness(
  options: {
    query?: Record<string, string>
    storage?: Map<string, string>
    userId?: string
    organizationId?: string
    unavailableStorage?: boolean
  } = {}
) {
  const storage = options.storage ?? new Map<string, string>()
  const route = reactive({
    path: '/admin/invoices',
    query: options.query ?? ({} as Record<string, string>),
    get fullPath(): string {
      const query = new URLSearchParams(this.query).toString()
      return this.path + (query ? '?' + query : '')
    }
  })
  const requests: Array<Record<string, string | number | undefined>> = []
  const replacements: Array<{ path: string; query: Record<string, string> }> = []
  const leaveGuards: Array<(to: object, from: { fullPath: string }) => void> = []
  const controls = { failPage: 0, total: 100 }
  const exports = {} as typeof import('../app/composables/useInvoicesAdminList')
  runInNewContext(listSource, {
    exports,
    ...reactivity,
    setTimeout,
    clearTimeout,
    useRoute: () => route,
    useRouter: () => ({
      replace: async (target: { path: string; query: Record<string, string> }) => {
        replacements.push(target)
        route.path = target.path
        route.query = target.query
      }
    }),
    usePortalSession: () => ({
      currentUser: ref({ id: options.userId ?? 'user' }),
      activeOrganizationId: ref(options.organizationId ?? 'organization')
    }),
    onBeforeRouteLeave: (guard: (typeof leaveGuards)[number]) => leaveGuards.push(guard),
    sessionStorage: {
      getItem: (key: string) => {
        if (options.unavailableStorage) {
          throw new Error('Storage unavailable')
        }
        return storage.get(key) ?? null
      },
      setItem: (key: string, value: string) => {
        if (options.unavailableStorage) {
          throw new Error('Storage unavailable')
        }
        storage.set(key, value)
      }
    },
    $fetch: async (_endpoint: string, request: { query: Record<string, string | number | undefined> }) => {
      requests.push({ ...request.query })
      if (request.query.page === controls.failPage) {
        throw new Error('List unavailable')
      }
      const pageCount = Math.ceil(controls.total / 20)
      const page = Math.max(1, Math.min(Number(request.query.page), pageCount))
      return {
        items: Array.from({ length: controls.total ? 20 : 0 }, (_, index) => ({ id: `${page}-${index}` })),
        pagination: { total: controls.total, page, pageCount, pageSize: 20 }
      }
    },
    require: (id: string) => {
      if (id.endsWith('/usePaginatedResource')) {
        return resourceExports
      }
      if (id.endsWith('/invoice-list-navigation')) {
        return { parseInvoiceListPosition }
      }
      throw new Error(`Unexpected import ${id}`)
    }
  })
  const scope = effectScope()
  const listing = scope.run(() =>
    exports.useInvoicesAdminList<{ id: string }>({
      endpoint: '/api/invoices/admin/invoices',
      filterKeys: ['status', 'clientOrganizationId', 'overdue'],
      defaultSort: 'issueDate',
      defaultSortDir: 'desc',
      preservePosition: true
    })
  )!
  const leave = () => {
    for (const guard of leaveGuards) {
      guard({}, { fullPath: route.fullPath })
    }
    route.path = '/admin/invoices/invoice-id'
    route.query = {}
  }
  return { listing, route, requests, replacements, storage, controls, leave, stop: () => scope.stop() }
}

test('invoice detail return URLs retain only the local sales list destination', () => {
  const url = '/admin/invoices?search=Jenni&status=PAID&sortBy=number&sortDir=asc&page=3'
  assert.equal(invoiceListReturnTo(url), url)
  assert.equal(invoiceListReturnTo('/admin/invoices'), '/admin/invoices')
  for (const value of [
    undefined,
    [url],
    '//example.com',
    'https://example.com',
    '/admin/invoices/id',
    '/admin/invoices-other'
  ]) {
    assert.equal(invoiceListReturnTo(value), undefined)
  }
})

test('position metadata rejects malformed ranges and invalid scroll offsets', () => {
  for (const value of [
    null,
    'invalid',
    'null',
    '{}',
    '{"firstPage":0,"lastPage":2,"scrollTop":1}',
    '{"firstPage":2,"lastPage":1,"scrollTop":1}',
    '{"firstPage":1.5,"lastPage":2,"scrollTop":1}',
    '{"firstPage":1,"lastPage":2,"scrollTop":-1}'
  ]) {
    assert.equal(parseInvoiceListPosition(value), undefined)
  }
  assert.deepEqual(parseInvoiceListPosition('{"firstPage":2,"lastPage":4,"scrollTop":1375}'), {
    firstPage: 2,
    lastPage: 4,
    scrollTop: 1375
  })
})

test('ascending direction, search, all filters and page survive list initialization', async (context) => {
  const fixture = harness({
    query: {
      search: 'Jenni',
      status: 'PAID',
      clientOrganizationId: 'client',
      overdue: 'false',
      sortBy: 'number',
      sortDir: 'asc',
      page: '3'
    }
  })
  context.after(fixture.stop)
  await fixture.listing.restore()
  assert.equal(fixture.listing.sortDir.value, 'asc')
  assert.equal(fixture.listing.currentPage.value, 3)
  assert.deepEqual(fixture.requests[0], {
    search: 'Jenni',
    status: 'PAID',
    clientOrganizationId: 'client',
    overdue: 'false',
    sortBy: 'number',
    sortDir: 'asc',
    page: 3,
    pageSize: 20
  })
  assert.equal(fixture.replacements.length, 0)
})

test('returning from detail refetches the accumulated window before restoring scroll and active page', async (context) => {
  const first = harness({ query: { status: 'PAID', sortDir: 'asc', page: '3' } })
  context.after(first.stop)
  await first.listing.restore()
  await first.listing.loadNext()
  await first.listing.loadPrevious()
  first.listing.updateScroll(1375)
  const query = { ...first.route.query }
  first.leave()
  assert.equal(first.storage.size, 1)
  const returned = harness({ query, storage: first.storage })
  context.after(returned.stop)
  await returned.listing.restore()
  assert.deepEqual(
    returned.requests.map((request) => request.page),
    [2, 3, 4]
  )
  assert.equal(returned.listing.items.value.length, 60)
  assert.equal(new Set(returned.listing.items.value.map((item) => item.id)).size, 60)
  assert.equal(returned.listing.firstLoadedPage.value, 2)
  assert.equal(returned.listing.lastLoadedPage.value, 4)
  assert.equal(returned.listing.currentPage.value, 2)
  assert.equal(returned.listing.pagination.value.page, 2)
  assert.equal(returned.listing.initialScrollTop.value, 1375)
  assert.equal(returned.replacements.length, 0)
  await returned.listing.loadNext()
  assert.equal(returned.requests.at(-1)!.page, 5)
  assert.equal(returned.listing.items.value.length, 80)
})

test('position snapshots are isolated by user, organization and collection query', async (context) => {
  const first = harness({ query: { status: 'PAID' } })
  context.after(first.stop)
  await first.listing.restore()
  first.listing.updateScroll(500)
  first.leave()
  for (const options of [{ userId: 'other' }, { organizationId: 'other' }, { query: { status: 'DRAFT' } }]) {
    const fixture = harness({ query: { status: 'PAID' }, storage: first.storage, ...options })
    context.after(fixture.stop)
    await fixture.listing.restore()
    assert.equal(fixture.listing.initialScrollTop.value, 0)
    assert.equal(fixture.requests.length, 1)
  }
})

test('Back/Forward query navigation hydrates controls once without route feedback loops', async (context) => {
  const fixture = harness()
  context.after(fixture.stop)
  await fixture.listing.restore()
  fixture.route.query = {
    search: 'invoice',
    status: 'PAID',
    clientOrganizationId: 'client',
    overdue: 'true',
    sortBy: 'totalMinor',
    sortDir: 'asc',
    page: '3'
  }
  await flush()
  assert.equal(fixture.listing.search.value, 'invoice')
  assert.equal(fixture.listing.filters.status, 'PAID')
  assert.equal(fixture.listing.filters.clientOrganizationId, 'client')
  assert.equal(fixture.listing.filters.overdue, 'true')
  assert.equal(fixture.listing.sortBy.value, 'totalMinor')
  assert.equal(fixture.listing.sortDir.value, 'asc')
  assert.equal(fixture.listing.currentPage.value, 3)
  assert.equal(fixture.requests.length, 2)
  assert.equal(fixture.replacements.length, 0)
  fixture.route.query = {}
  await flush()
  assert.equal(fixture.listing.search.value, '')
  assert.equal(fixture.listing.sortDir.value, 'desc')
  assert.equal(fixture.listing.filters.status, undefined)
  assert.equal(fixture.listing.currentPage.value, 1)
  assert.equal(fixture.requests.length, 3)
})

test('changing filters resets the page and scroll and issues one collection request', async (context) => {
  const fixture = harness({ query: { page: '3' } })
  context.after(fixture.stop)
  await fixture.listing.restore()
  fixture.listing.updateScroll(700)
  const previousKey = fixture.listing.scrollKey.value
  fixture.listing.setFilter('status', 'PAID')
  await flush()
  assert.equal(fixture.listing.currentPage.value, 1)
  assert.equal(fixture.listing.initialScrollTop.value, 0)
  assert.ok(fixture.listing.scrollKey.value > previousKey)
  assert.equal(fixture.route.query.page, undefined)
  assert.equal(fixture.route.query.status, 'PAID')
  assert.equal(fixture.requests.length, 2)
})

test('leaving cancels a debounced search instead of rewriting the invoice-detail route', async (context) => {
  const fixture = harness()
  context.after(fixture.stop)
  await fixture.listing.restore()
  fixture.listing.search.value = 'unfinished'
  fixture.leave()
  await new Promise((resolve) => setTimeout(resolve, 350))
  assert.equal(fixture.requests.length, 1)
  assert.equal(fixture.replacements.length, 0)
  assert.equal(fixture.route.path, '/admin/invoices/invoice-id')
})

test('restoration bounds the saved window to the latest server page count', async (context) => {
  const storage = new Map([
    [
      'invoices:list-position:user:organization:/admin/invoices?page=2',
      JSON.stringify({ firstPage: 1, lastPage: 4, scrollTop: 900 })
    ]
  ])
  const fixture = harness({ query: { page: '2' }, storage })
  context.after(fixture.stop)
  fixture.controls.total = 40
  await fixture.listing.restore()
  assert.deepEqual(
    fixture.requests.map((request) => request.page),
    [1, 2]
  )
  assert.equal(fixture.listing.lastLoadedPage.value, 2)
  assert.equal(fixture.listing.items.value.length, 40)
  assert.equal(fixture.listing.initialScrollTop.value, 900)
})

test('failed page restoration stops without applying an offset to an incomplete window', async (context) => {
  const storage = new Map([
    [
      'invoices:list-position:user:organization:/admin/invoices?page=2',
      JSON.stringify({ firstPage: 1, lastPage: 3, scrollTop: 900 })
    ]
  ])
  const fixture = harness({ query: { page: '2' }, storage })
  context.after(fixture.stop)
  fixture.controls.failPage = 2
  await fixture.listing.restore()
  assert.deepEqual(
    fixture.requests.map((request) => request.page),
    [1, 2]
  )
  assert.equal(fixture.listing.currentPage.value, 1)
  assert.equal(fixture.listing.initialScrollTop.value, 0)
  assert.equal(fixture.listing.error.value?.message, 'List unavailable')
})

test('unavailable session storage does not prevent loading or navigating away', async (context) => {
  const fixture = harness({ unavailableStorage: true })
  context.after(fixture.stop)
  await fixture.listing.restore()
  assert.equal(fixture.requests.length, 1)
  assert.doesNotThrow(fixture.leave)
})

test('sales links and list restoration preserve the order return path and direct-detail fallback', () => {
  const list = readFileSync(new URL('../app/components/InvoicesAdminInvoices.vue', import.meta.url), 'utf8')
  const detail = readFileSync(new URL('../app/pages/admin/invoices/[id].vue', import.meta.url), 'utf8')
  const component = readFileSync(new URL('../app/components/InvoicesInvoiceDetail.vue', import.meta.url), 'utf8')
  assert.equal(list.match(/invoicesReturnTo: route.fullPath/g)?.length, 2)
  assert.match(list, /:initial-scroll-top="listing.initialScrollTop.value"/)
  assert.match(list, /@scroll="listing.updateScroll"/)
  assert.match(list, /await listing.restore\(\)/)
  assert.match(detail, /:back-to="ordersReturnTo \|\| invoicesReturnTo"/)
  assert.match(component, /backTo \|\| \(isClient \? '\/invoices' : '\/admin\/invoices'\)/)
})
