<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const { open } = useContentSearch()

function enhanceSearchDialog() {
  const listbox = document.querySelector<HTMLElement>('[role="dialog"] [role="listbox"]')
  if (!listbox) {
    return false
  }

  listbox.setAttribute('aria-label', 'Documentation search results')

  const viewport = listbox.querySelector<HTMLElement>('[data-slot="viewport"]')
  const firstOption = viewport?.querySelector<HTMLElement>('[role="option"]')
  firstOption?.setAttribute('tabindex', '0')

  return true
}

watch(
  open,
  async (isOpen) => {
    if (!isOpen || !import.meta.client) {
      return
    }

    await nextTick()

    if (enhanceSearchDialog()) {
      return
    }

    requestAnimationFrame(enhanceSearchDialog)
  },
  { flush: 'post' }
)
</script>

<template>
  <UContentSearch
    v-bind="$attrs"
    title="Search documentation"
    description="Search Customer Portal documentation or navigate to a section."
    :ui="{
      input: '[&_input]:placeholder:text-highlighted',
      itemLabelSuffix: 'text-default',
      item: 'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary'
    }"
  />
</template>
