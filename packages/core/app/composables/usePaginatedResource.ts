export interface PaginationState {
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export interface PaginatedResult<Item> {
  items: Item[]
  pagination: PaginationState
}

export interface PaginatedFetchContext<Filters> {
  filters: Filters
  page: number
  pageSize: number
  signal: AbortSignal
}

export interface PaginatedResourceOptions<Item, Filters> {
  fetchPage: (context: PaginatedFetchContext<Filters>) => Promise<PaginatedResult<Item>>
  getKey: (item: Item) => PropertyKey
  pageSize?: number
}

export const usePaginatedResource = <Item, Filters extends object>(
  options: PaginatedResourceOptions<Item, Filters>
) => {
  const defaultPageSize = options.pageSize ?? 20
  const items = ref<Item[]>([]) as Ref<Item[]>
  const pagination = ref<PaginationState>({
    total: 0,
    page: 1,
    pageSize: defaultPageSize,
    pageCount: 0
  })
  const pending = ref(false)
  const loadingNextPage = ref(false)
  const loadingPreviousPage = ref(false)
  const error = ref<Error | null>(null)
  const firstLoadedPage = ref(1)
  const lastLoadedPage = ref(1)

  let requestSequence = 0
  let abortController: AbortController | undefined
  let activeFilters: Filters | undefined

  const loadPage = async (
    filters: Filters,
    loadOptions: {
      mode?: 'replace' | 'append' | 'prepend'
      page?: number
      pageSize?: number
    } = {}
  ) => {
    const sequence = ++requestSequence
    const page = loadOptions.page ?? 1
    const pageSize = loadOptions.pageSize ?? defaultPageSize
    const mode = loadOptions.mode ?? 'replace'
    activeFilters = filters
    abortController?.abort()
    abortController = new AbortController()
    pending.value = true
    loadingNextPage.value = mode === 'append'
    loadingPreviousPage.value = mode === 'prepend'
    error.value = null

    try {
      const result = await options.fetchPage({
        filters,
        page,
        pageSize,
        signal: abortController.signal
      })

      if (sequence !== requestSequence) return
      if (mode === 'append') {
        const existingKeys = new Set(items.value.map(options.getKey))
        items.value = [
          ...items.value,
          ...result.items.filter(item => !existingKeys.has(options.getKey(item)))
        ]
        lastLoadedPage.value = Math.max(lastLoadedPage.value, result.pagination.page)
      } else if (mode === 'prepend') {
        const existingKeys = new Set(items.value.map(options.getKey))
        items.value = [
          ...result.items.filter(item => !existingKeys.has(options.getKey(item))),
          ...items.value
        ]
        firstLoadedPage.value = Math.min(firstLoadedPage.value, result.pagination.page)
      } else {
        items.value = result.items
        firstLoadedPage.value = result.pagination.page
        lastLoadedPage.value = result.pagination.page
      }
      pagination.value = result.pagination
      return result
    } catch (cause) {
      if (sequence !== requestSequence || (cause instanceof Error && cause.name === 'AbortError')) return
      error.value = cause instanceof Error ? cause : new Error('Failed to load data')
      throw cause
    } finally {
      if (sequence === requestSequence) {
        pending.value = false
        loadingNextPage.value = false
        loadingPreviousPage.value = false
      }
    }
  }

  const loadNextPage = (filters: Filters = activeFilters as Filters) => {
    if (!filters || pending.value || lastLoadedPage.value >= pagination.value.pageCount) return
    return loadPage(filters, {
      mode: 'append',
      page: lastLoadedPage.value + 1,
      pageSize: pagination.value.pageSize
    })
  }

  const loadPreviousPage = (filters: Filters = activeFilters as Filters) => {
    if (!filters || pending.value || firstLoadedPage.value <= 1) return
    return loadPage(filters, {
      mode: 'prepend',
      page: firstLoadedPage.value - 1,
      pageSize: pagination.value.pageSize
    })
  }

  const reset = () => {
    abortController?.abort()
    requestSequence++
    items.value = []
    pagination.value = {
      total: 0,
      page: 1,
      pageSize: defaultPageSize,
      pageCount: 0
    }
    pending.value = false
    loadingNextPage.value = false
    loadingPreviousPage.value = false
    error.value = null
    firstLoadedPage.value = 1
    lastLoadedPage.value = 1
  }

  onScopeDispose(() => abortController?.abort())

  return {
    items: readonly(items),
    pagination: readonly(pagination),
    pending: readonly(pending),
    loadingNextPage: readonly(loadingNextPage),
    loadingPreviousPage: readonly(loadingPreviousPage),
    firstLoadedPage: readonly(firstLoadedPage),
    lastLoadedPage: readonly(lastLoadedPage),
    hasNextPage: computed(() => lastLoadedPage.value < pagination.value.pageCount),
    hasPreviousPage: computed(() => firstLoadedPage.value > 1),
    error: readonly(error),
    loadPage,
    loadNextPage,
    loadPreviousPage,
    reset
  }
}
