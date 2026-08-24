<script setup lang="ts">
const props = defineProps<{
  githubPath?: string
  title?: string
}>()

const { editPageUrl, reportPageUrl, sourceRevisionLabel, sourceRevisionUrl } = useDocumentationLinks({
  githubPath: toRef(props, 'githubPath'),
  title: toRef(props, 'title')
})
</script>

<template>
  <aside
    class="mt-12 flex flex-col gap-5 border-y border-default py-6 sm:flex-row sm:items-center sm:justify-between"
    aria-labelledby="docs-feedback-title"
  >
    <div class="max-w-2xl">
      <h2 id="docs-feedback-title" class="text-base font-semibold text-highlighted">Help improve this page</h2>
      <p class="mt-1 text-sm text-muted">
        Found something unclear, incomplete, or outdated? Open a focused report or propose a correction in the
        documentation source.
      </p>
      <p class="mt-2 text-sm text-muted">
        Verified against Customer Portal
        <a
          class="font-medium text-primary underline underline-offset-2"
          :href="sourceRevisionUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          <code>{{ sourceRevisionLabel }}</code> </a
        >.
      </p>
    </div>

    <div class="flex shrink-0 flex-wrap items-center gap-2">
      <UButton
        label="Report a docs issue"
        icon="i-lucide-message-square-warning"
        color="neutral"
        target="_blank"
        rel="noopener noreferrer"
        :to="reportPageUrl"
      />
      <UButton
        v-if="editPageUrl"
        label="Edit this page"
        icon="i-lucide-pencil-line"
        color="neutral"
        variant="outline"
        target="_blank"
        rel="noopener noreferrer"
        :to="editPageUrl"
      />
    </div>
  </aside>
</template>
