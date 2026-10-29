import type { Ref } from 'vue'

type Slot = { x: number; y: number }
export const useMediaDragOrder = (options: {
  ids: Readonly<Ref<string[]>>
  disabled: Readonly<Ref<boolean>>
  container: Ref<HTMLElement | null>
  selector: string
  scrollContainer?: Ref<HTMLElement | null>
}) => {
  const draggedId = ref(''),
    dragOrder = ref<string[]>([])
  const orderedIds = computed(() => (draggedId.value ? dragOrder.value : options.ids.value))
  let slots: Slot[] = [],
    pointer: Slot | undefined,
    scrollElement: HTMLElement | undefined
  let frame: number | undefined, previewFrame: number | undefined, preview: HTMLElement | undefined
  const measure = () => {
    slots = Array.from(options.container.value?.querySelectorAll<HTMLElement>(options.selector) || []).map((card) => ({
      x: card.offsetLeft + card.offsetWidth / 2,
      y: card.offsetTop + card.offsetHeight / 2
    }))
  }
  function removePreview() {
    if (previewFrame !== undefined) {
      cancelAnimationFrame(previewFrame)
    }
    previewFrame = undefined
    preview?.remove()
    preview = undefined
  }
  function stopScroll() {
    if (!import.meta.client) {
      return
    }
    if (frame !== undefined) {
      cancelAnimationFrame(frame)
    }
    frame = undefined
    pointer = undefined
    document.removeEventListener('dragover', trackPointer, true)
    document.removeEventListener('drop', stopScroll, true)
    window.removeEventListener('blur', cancel)
    window.removeEventListener('resize', cancel)
  }
  function cancel() {
    stopScroll()
    if (import.meta.client) {
      removePreview()
    }
    draggedId.value = ''
    dragOrder.value = []
  }
  function trackPointer(event: DragEvent) {
    if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
      pointer = { x: event.clientX, y: event.clientY }
    }
  }
  function movePointer(x: number, y: number) {
    const container = options.container.value
    if (!container || !draggedId.value || options.disabled.value || !slots.length) {
      return
    }
    const bounds = container.getBoundingClientRect()
    let target = -1,
      distance = Infinity
    slots.forEach((slot, index) => {
      const next = (slot.x - (x - bounds.left)) ** 2 + (slot.y - (y - bounds.top)) ** 2
      if (next < distance) {
        distance = next
        target = index
      }
    })
    const ids = [...dragOrder.value],
      from = ids.indexOf(draggedId.value)
    if (from < 0 || target < 0 || from === target) {
      return
    }
    ids.splice(target, 0, ids.splice(from, 1)[0]!)
    dragOrder.value = ids
  }
  function findScrollContainer() {
    if (options.scrollContainer?.value) {
      return options.scrollContainer.value
    }
    let node = options.container.value?.parentElement
    while (node) {
      if (/(auto|scroll)/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight) {
        return node
      }
      node = node.parentElement
    }
    return document.scrollingElement as HTMLElement
  }
  function startScroll() {
    document.addEventListener('dragover', trackPointer, true)
    document.addEventListener('drop', stopScroll, true)
    window.addEventListener('blur', cancel)
    window.addEventListener('resize', cancel)
    let previous: number | undefined
    function tick(time: number) {
      const elapsed = Math.min(32, previous === undefined ? 16 : time - previous)
      previous = time
      if (!draggedId.value) {
        return
      }
      if (scrollElement && pointer) {
        const rect =
          scrollElement === document.scrollingElement
            ? { top: 0, bottom: innerHeight, left: 0, right: innerWidth }
            : scrollElement.getBoundingClientRect()
        const top = Math.max(0, rect.top),
          bottom = Math.min(innerHeight, rect.bottom),
          edge = Math.min(80, (bottom - top) / 3)
        const { x, y } = pointer
        if (edge > 0 && x >= rect.left && x <= rect.right && y >= top - 40 && y <= bottom + 40) {
          const direction = y < top + edge ? -1 : y > bottom - edge ? 1 : 0
          const proximity = direction < 0 ? (top + edge - y) / edge : (y - bottom + edge) / edge
          const before = scrollElement.scrollTop
          scrollElement.scrollTop = Math.max(
            0,
            Math.min(
              scrollElement.scrollHeight - scrollElement.clientHeight,
              before + direction * Math.min(1, proximity) * elapsed * 0.8
            )
          )
          if (scrollElement.scrollTop !== before) {
            movePointer(x, y)
          }
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
  }
  function start(event: DragEvent, id: string) {
    if (options.disabled.value) {
      event.preventDefault()
      return
    }
    cancel()
    const card = event.currentTarget as HTMLElement
    measure()
    if (event.dataTransfer) {
      const bounds = card.getBoundingClientRect()
      preview = card.cloneNode(true) as HTMLElement
      preview.removeAttribute('data-product-image-id')
      preview.removeAttribute('data-media-id')
      preview.setAttribute('aria-hidden', 'true')
      preview.setAttribute('data-drag-preview', '')
      Object.assign(preview.style, {
        position: 'fixed',
        left: `${bounds.left}px`,
        top: `${bounds.top}px`,
        width: `${bounds.width}px`,
        height: `${bounds.height}px`,
        margin: '0',
        transform: 'none',
        transition: 'none',
        pointerEvents: 'none',
        zIndex: '2147483647'
      })
      document.body.appendChild(preview)
      event.dataTransfer.setDragImage(
        preview,
        Math.max(0, event.clientX - bounds.left),
        Math.max(0, event.clientY - bounds.top)
      )
      previewFrame = requestAnimationFrame(removePreview)
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', id)
    }
    dragOrder.value = [...options.ids.value]
    draggedId.value = id
    scrollElement = findScrollContainer()
    trackPointer(event)
    startScroll()
  }
  function over(event: DragEvent) {
    if (!draggedId.value || options.disabled.value) {
      return
    }
    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move'
    }
    trackPointer(event)
    movePointer(event.clientX, event.clientY)
  }
  function finish() {
    if (!draggedId.value || options.disabled.value) {
      cancel()
      return
    }
    const ids = [...dragOrder.value],
      id = draggedId.value,
      index = ids.indexOf(id)
    const result = { id, ids, beforeId: ids[index + 1] || null }
    cancel()
    return result
  }
  watch(options.disabled, (disabled) => {
    if (disabled) {
      cancel()
    }
  })
  watch(options.ids, async (ids) => {
    if (!draggedId.value) {
      return
    }
    if (!ids.includes(draggedId.value)) {
      cancel()
      return
    }
    const current = new Set(dragOrder.value),
      first = ids.findIndex((id) => current.has(id))
    const prefix = ids.slice(0, Math.max(0, first)).filter((id) => !current.has(id))
    dragOrder.value = [
      ...prefix,
      ...dragOrder.value.filter((id) => ids.includes(id)),
      ...ids.filter((id) => !current.has(id) && !prefix.includes(id))
    ]
    await nextTick()
    measure()
  })
  onBeforeUnmount(cancel)
  return { draggedId, orderedIds, start, over, finish, cancel }
}
