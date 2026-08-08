<script setup lang="ts">
import { useClipboard } from '@vueuse/core'

const props = defineProps<{
  githubPath?: string
  title?: string
}>()

const route = useRoute()
const toast = useToast()
const { copy, copied } = useClipboard()
const { editPageUrl, markdownPath, reportPageUrl } = useDocumentationLinks({
  githubPath: toRef(props, 'githubPath'),
  title: toRef(props, 'title')
})

const items = computed(() => [
  ...(editPageUrl.value
    ? [{
        label: 'Edit page on GitHub',
        icon: 'i-lucide-pencil-line',
        target: '_blank',
        to: editPageUrl.value
      }]
    : []),
  {
    label: 'Report a docs issue',
    icon: 'i-lucide-message-square-warning',
    target: '_blank',
    to: reportPageUrl.value
  },
  {
    label: 'Copy Markdown link',
    icon: 'i-lucide-link',
    onSelect() {
      copy(markdownPath.value)
      toast.add({
        title: 'Copied to clipboard',
        icon: 'i-lucide-check-circle'
      })
    }
  },
  {
    label: 'View as Markdown',
    icon: 'i-simple-icons:markdown',
    target: '_blank',
    to: `/raw${route.path}.md`
  },
  {
    label: 'Open in ChatGPT',
    icon: 'i-simple-icons:openai',
    target: '_blank',
    to: `https://chatgpt.com/?hints=search&q=${encodeURIComponent(`Read ${markdownPath.value} so I can ask questions about it.`)}`
  },
  {
    label: 'Open in Claude',
    icon: 'i-simple-icons:anthropic',
    target: '_blank',
    to: `https://claude.ai/new?q=${encodeURIComponent(`Read ${markdownPath.value} so I can ask questions about it.`)}`
  }
])

async function copyPage() {
  copy(await $fetch<string>(`/raw${route.path}.md`))
}
</script>

<template>
  <UFieldGroup>
    <UButton
      v-if="editPageUrl"
      label="Edit page"
      icon="i-lucide-pencil-line"
      color="neutral"
      variant="outline"
      target="_blank"
      :to="editPageUrl"
    />
    <UButton
      label="Copy page"
      :icon="copied ? 'i-lucide-copy-check' : 'i-lucide-copy'"
      color="neutral"
      variant="outline"
      :ui="{
        leadingIcon: [copied ? 'text-primary' : 'text-neutral', 'size-3.5']
      }"
      @click="copyPage"
    />
    <UDropdownMenu
      :items="items"
      :content="{
        align: 'end',
        side: 'bottom',
        sideOffset: 8
      }"
      :ui="{
        content: 'w-56'
      }"
    >
      <UButton
        icon="i-lucide-chevron-down"
        size="sm"
        color="neutral"
        variant="outline"
        aria-label="Open copy actions menu"
      />
    </UDropdownMenu>
  </UFieldGroup>
</template>
