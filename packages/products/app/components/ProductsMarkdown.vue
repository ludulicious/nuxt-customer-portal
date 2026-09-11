<script setup lang="ts">
import { defaultMarkdownStyle, type MarkdownStyle } from '../../shared/markdown-style'

const props = defineProps<{ html: string; theme?: MarkdownStyle }>()
const style = computed(() => {
  const theme = props.theme || defaultMarkdownStyle()
  const fonts = {
    system: 'system-ui, sans-serif',
    sans: 'Arial, Helvetica, sans-serif',
    serif: 'Georgia, Times New Roman, serif'
  }
  const bullets = { disc: '•', circle: '◦', square: '▪', dash: '–', check: '✓', sparkle: '✦' }
  return {
    '--store-content-bullet': `"${bullets[theme.bulletStyle || 'disc']}  "`,
    '--store-content-bullet-color': theme.bulletColor || 'inherit',
    '--store-content-font': fonts[theme.fontFamily],
    '--store-content-size': `${theme.fontSize}px`,
    '--store-content-leading': theme.lineHeight,
    '--store-content-gap': `${theme.paragraphSpacing}em`,
    '--store-content-scale': theme.headingScale,
    '--store-content-text': theme.textColor || 'inherit',
    '--store-content-heading': theme.headingColor || 'inherit',
    '--store-content-link': theme.linkColor || 'var(--ui-primary)',
    backgroundColor: theme.backgroundColor || undefined,
    padding: theme.backgroundColor ? '1rem' : undefined
  }
})
</script>

<template>
  <!-- HTML comes from the server's allowlisted Markdown renderer or the static settings sample. -->
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div class="store-markdown" :style="style" v-html="html" />
</template>

<style scoped>
.store-markdown {
  font-family: var(--store-content-font);
  font-size: var(--store-content-size);
  line-height: var(--store-content-leading);
  color: var(--store-content-text);
  overflow-wrap: anywhere;
}
.store-markdown :deep(p),
.store-markdown :deep(ul),
.store-markdown :deep(ol),
.store-markdown :deep(blockquote),
.store-markdown :deep(pre) {
  margin: 0 0 var(--store-content-gap);
}
.store-markdown :deep(h1),
.store-markdown :deep(h2),
.store-markdown :deep(h3),
.store-markdown :deep(h4),
.store-markdown :deep(h5),
.store-markdown :deep(h6) {
  color: var(--store-content-heading);
  font-family: inherit;
  font-weight: 700;
  line-height: 1.3;
  margin: 1.5em 0 0.6em;
}
.store-markdown :deep(h1) {
  font-size: calc(1.8em * var(--store-content-scale));
}
.store-markdown :deep(h2) {
  font-size: calc(1.5em * var(--store-content-scale));
}
.store-markdown :deep(h3) {
  font-size: calc(1.2em * var(--store-content-scale));
}
.store-markdown :deep(h4),
.store-markdown :deep(h5),
.store-markdown :deep(h6) {
  font-size: calc(1em * var(--store-content-scale));
}
.store-markdown :deep(ul) {
  list-style: disc;
  padding-left: 1.5em;
}
.store-markdown :deep(ul > li::marker) {
  content: var(--store-content-bullet);
  color: var(--store-content-bullet-color);
  font-family: system-ui, sans-serif;
}
.store-markdown :deep(ol) {
  list-style: decimal;
  padding-left: 1.5em;
}
.store-markdown :deep(li) {
  margin: 0.3em 0;
}
.store-markdown :deep(li > ul),
.store-markdown :deep(li > ol) {
  margin-bottom: 0;
}
.store-markdown :deep(strong) {
  font-weight: 700;
}
.store-markdown :deep(em) {
  font-style: italic;
}
.store-markdown :deep(a) {
  color: var(--store-content-link);
  text-decoration: underline;
  text-underline-offset: 0.15em;
}
.store-markdown :deep(blockquote) {
  border-left: 3px solid currentColor;
  padding-left: 1em;
  font-style: italic;
}
.store-markdown :deep(code) {
  font-family: monospace;
  font-size: 0.9em;
  background: color-mix(in srgb, currentColor 8%, transparent);
  padding: 0.1em 0.25em;
  border-radius: 0.2em;
}
.store-markdown :deep(pre) {
  overflow-x: auto;
  padding: 1em;
  background: color-mix(in srgb, currentColor 8%, transparent);
  border-radius: 0.4em;
}
.store-markdown :deep(pre code) {
  padding: 0;
  background: none;
}
.store-markdown :deep(hr) {
  margin: 1.5em 0;
  border: 0;
  border-top: 1px solid currentColor;
  opacity: 0.25;
}
.store-markdown :deep(> :first-child) {
  margin-top: 0;
}
.store-markdown :deep(> :last-child) {
  margin-bottom: 0;
}
</style>
