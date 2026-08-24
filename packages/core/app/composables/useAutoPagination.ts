export interface AutoPaginationOptions {
  sentinel: Ref<HTMLElement | null>
  scrollContainer?: Ref<HTMLElement | null>
  canLoadMore: MaybeRefOrGetter<boolean>
  loading: MaybeRefOrGetter<boolean>
  loadMore: () => unknown
  rootMargin?: string
}

export const useAutoPagination = (options: AutoPaginationOptions) => {
  const { stop } = useIntersectionObserver(
    options.sentinel,
    ([entry]) => {
      if (!entry?.isIntersecting) {
        return
      }
      if (toValue(options.loading) || !toValue(options.canLoadMore)) {
        return
      }
      void options.loadMore()
    },
    {
      root: options.scrollContainer,
      rootMargin: options.rootMargin ?? '0px 0px 240px 0px',
      threshold: 0
    }
  )

  return { stop }
}
