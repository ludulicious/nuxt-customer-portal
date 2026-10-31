<script setup lang="ts">
import { renderLegalMarkdown } from '../../shared/legal-markdown'

const props = defineProps<{ title: string; body: string }>()
const html = computed(() => renderLegalMarkdown(props.body))
</script>

<template>
  <article class="legal-page">
    <p class="eyebrow">Legal</p>
    <h1>{{ title }}</h1>
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div class="legal-content" v-html="html" />
  </article>
</template>

<style scoped>
.legal-page {
  max-width: 52rem;
  margin: 0 auto;
  padding: clamp(2rem, 7vw, 6rem) 1rem;
}
.legal-page > h1 {
  font-size: clamp(2.5rem, 7vw, 5rem);
  font-weight: 850;
  overflow-wrap: anywhere;
  margin-bottom: 3rem;
}
.legal-content {
  line-height: 1.75;
  color: var(--ui-text-muted);
  overflow-wrap: anywhere;
}
.legal-content :deep(p),
.legal-content :deep(ul),
.legal-content :deep(ol),
.legal-content :deep(blockquote),
.legal-content :deep(pre),
.legal-content :deep(table),
.legal-content :deep(hr) {
  margin-bottom: 1.25em;
}
.legal-content :deep(h1),
.legal-content :deep(h2),
.legal-content :deep(h3),
.legal-content :deep(h4),
.legal-content :deep(h5),
.legal-content :deep(h6) {
  margin: 1.5em 0 0.6em;
  color: var(--ui-text-highlighted);
  font-weight: 700;
  line-height: 1.3;
}
.legal-content :deep(h1) {
  font-size: 2em;
}
.legal-content :deep(h2) {
  font-size: 1.5em;
}
.legal-content :deep(h3) {
  font-size: 1.25em;
}
.legal-content :deep(ul) {
  list-style: disc;
  padding-left: 1.5em;
}
.legal-content :deep(ol) {
  list-style: decimal;
  padding-left: 1.5em;
}
.legal-content :deep(a) {
  color: var(--ui-primary);
  text-decoration: underline;
}
.legal-content :deep(blockquote) {
  border-left: 3px solid var(--ui-border);
  padding-left: 1em;
}
.legal-content :deep(pre) {
  overflow-x: auto;
  padding: 1rem;
  background: var(--ui-bg-elevated);
}
.legal-content :deep(table) {
  display: block;
  overflow-x: auto;
  border-collapse: collapse;
}
.legal-content :deep(th),
.legal-content :deep(td) {
  border: 1px solid var(--ui-border);
  padding: 0.5em 0.75em;
  text-align: left;
}
.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--portal-primary);
}
</style>
