import type { InvoicesListResponse } from '@nuxt-customer-portal/invoices/shared/types/invoice'
import { usePaginatedResource } from '@nuxt-customer-portal/core/app/composables/usePaginatedResource'
import { parseInvoiceListPosition } from '@nuxt-customer-portal/invoices/shared/invoice-list-navigation'

export const useInvoicesAdminList = <Item>(options: {
  endpoint: string
  filterKeys?: string[]
  defaultFilters?: Record<string, string>
  defaultSort: string
  defaultSortDir?: 'asc' | 'desc'
  preservePosition?: boolean
}) => {
  const route = useRoute()
  const router = useRouter()
  const listPath = route.path
  const session = options.preservePosition ? usePortalSession() : undefined
  const positionKey = (fullPath: string) =>
    `invoices:list-position:${session?.currentUser.value?.id}:${session?.activeOrganizationId.value}:${fullPath}`
  const initialScrollTop = ref(0)
  const scrollKey = ref(0)
  let scrollTop = 0
  const pageSize = 20
  const defaultSortDir = options.defaultSortDir ?? 'asc'
  const search = ref(String(route.query.search ?? ''))
  const sortBy = ref(String(route.query.sortBy ?? options.defaultSort))
  const sortDir = ref<'asc' | 'desc'>(
    route.query.sortDir === 'asc' || route.query.sortDir === 'desc' ? route.query.sortDir : defaultSortDir
  )
  const currentPage = ref(Math.max(1, Number(route.query.page) || 1))
  const filters = reactive<Record<string, string | undefined>>(
    Object.fromEntries(
      (options.filterKeys ?? []).map((key) => [
        key,
        route.query[key] ? String(route.query[key]) : options.defaultFilters?.[key]
      ])
    )
  )
  const resource = usePaginatedResource<Item, Record<string, string | undefined>>({
    pageSize,
    getKey: (item) => (item as { id: string }).id,
    fetchPage: ({ filters: query, page, pageSize, signal }) =>
      $fetch<InvoicesListResponse<Item>, string>(options.endpoint, { query: { ...query, page, pageSize }, signal })
  })
  const query = () => ({
    ...(search.value.trim() ? { search: search.value.trim() } : {}),
    ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
    ...(sortBy.value !== options.defaultSort ? { sortBy: sortBy.value } : {}),
    ...(sortDir.value !== defaultSortDir ? { sortDir: sortDir.value } : {})
  })
  const routeQuery = () => ({
    ...(search.value.trim() ? { search: search.value.trim() } : {}),
    ...Object.fromEntries(
      Object.entries(filters).filter(([key, value]) => value && value !== options.defaultFilters?.[key])
    ),
    ...(sortBy.value !== options.defaultSort ? { sortBy: sortBy.value } : {}),
    ...(sortDir.value !== defaultSortDir ? { sortDir: sortDir.value } : {})
  })
  const syncRoute = (page = currentPage.value) =>
    router.replace({ path: listPath, query: { ...routeQuery(), ...(page > 1 ? { page: String(page) } : {}) } })
  const load = async (page = currentPage.value) => {
    initialScrollTop.value = 0
    scrollTop = 0
    scrollKey.value++
    const result = await resource.loadPage(query(), { page, pageSize })
    if (result) {
      currentPage.value = result.pagination.page
    }
    return result
  }
  const restore = async () => {
    if (!import.meta.client || !options.preservePosition) {
      return load()
    }
    let position
    try {
      position = parseInvoiceListPosition(sessionStorage.getItem(positionKey(route.fullPath)))
    } catch {
      return load()
    }
    if (!position || currentPage.value < position.firstPage || currentPage.value > position.lastPage) {
      return load()
    }
    const page = currentPage.value
    let result = await resource.loadPage(query(), { page: position.firstPage, pageSize })
    if (!result) {
      return
    }
    const lastPage = Math.min(position.lastPage, result.pagination.pageCount)
    while (resource.lastLoadedPage.value < lastPage) {
      result = await resource.loadNextPage(query())
      if (!result) {
        currentPage.value = resource.pagination.value.page
        return
      }
    }
    currentPage.value = Math.max(1, Math.min(page, result.pagination.pageCount))
    initialScrollTop.value = position.scrollTop
    scrollTop = position.scrollTop
    return result
  }
  const updateScroll = (value: number) => {
    scrollTop = value
  }
  const resetAndLoad = async () => {
    currentPage.value = 1
    await syncRoute(1)
    await load(1)
  }
  const loadNext = async () => {
    const result = await resource.loadNextPage(query())
    if (result) {
      currentPage.value = result.pagination.page
      await syncRoute(currentPage.value)
    }
  }
  const loadPrevious = async () => {
    const result = await resource.loadPreviousPage(query())
    if (result) {
      currentPage.value = result.pagination.page
      await syncRoute(currentPage.value)
    }
    return result
  }
  const goToPage = async (page: number) => {
    currentPage.value = page
    await syncRoute(page)
    await load(page)
  }
  const setFilter = (key: string, value: string | undefined) => {
    filters[key] = value
  }
  const toggleSortDir = () => {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  }
  let searchTimer: ReturnType<typeof setTimeout> | undefined
  let applyingRoute = false
  watch(
    search,
    () => {
      if (applyingRoute) {
        return
      }
      clearTimeout(searchTimer)
      searchTimer = setTimeout(() => {
        void resetAndLoad()
      }, 300)
    },
    { flush: 'sync' }
  )
  watch(
    [sortBy, sortDir, ...Object.keys(filters).map((key) => () => filters[key])],
    () => {
      if (applyingRoute) {
        return
      }
      clearTimeout(searchTimer)
      void resetAndLoad()
    },
    { flush: 'sync' }
  )
  watch(
    () => route.query,
    async (routeQuery) => {
      if (route.path !== listPath) {
        return
      }
      const nextSearch = String(routeQuery.search ?? '')
      const nextSort = String(routeQuery.sortBy ?? options.defaultSort)
      const nextDir =
        routeQuery.sortDir === 'asc' || routeQuery.sortDir === 'desc' ? routeQuery.sortDir : defaultSortDir
      const nextPage = Math.max(1, Number(routeQuery.page) || 1)
      const nextFilters = Object.fromEntries(
        (options.filterKeys ?? []).map((key) => [
          key,
          routeQuery[key] ? String(routeQuery[key]) : options.defaultFilters?.[key]
        ])
      )
      if (
        nextSearch === search.value.trim() &&
        nextSort === sortBy.value &&
        nextDir === sortDir.value &&
        nextPage === currentPage.value &&
        Object.keys(nextFilters).every((key) => nextFilters[key] === filters[key])
      ) {
        return
      }
      clearTimeout(searchTimer)
      applyingRoute = true
      search.value = nextSearch
      sortBy.value = nextSort
      sortDir.value = nextDir
      currentPage.value = nextPage
      Object.assign(filters, nextFilters)
      applyingRoute = false
      await load(nextPage)
    }
  )
  onBeforeRouteLeave((_to, from) => {
    clearTimeout(searchTimer)
    if (!import.meta.client || !options.preservePosition || !resource.items.value.length) {
      return
    }
    try {
      sessionStorage.setItem(
        positionKey(from.fullPath),
        JSON.stringify({
          firstPage: resource.firstLoadedPage.value,
          lastPage: resource.lastLoadedPage.value,
          scrollTop
        })
      )
    } catch {
      return
    }
  })
  onScopeDispose(() => clearTimeout(searchTimer))
  return {
    ...resource,
    pagination: computed(() => ({ ...resource.pagination.value, page: currentPage.value })),
    initialScrollTop,
    scrollKey,
    search,
    filters,
    sortBy,
    sortDir,
    currentPage,
    load,
    restore,
    updateScroll,
    refresh: load,
    loadNext,
    loadPrevious,
    goToPage,
    setFilter,
    toggleSortDir
  }
}
