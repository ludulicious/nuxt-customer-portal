<script setup lang="ts">
import { defaultMarkdownStyle, type MarkdownStyle } from '../../shared/markdown-style'

const theme = defineModel<MarkdownStyle>({ required: true })
const { t } = useI18n()
const fontOptions = computed(() =>
  ['system', 'sans', 'serif'].map((value) => ({ value, label: t(`products.markdown.${value}`) }))
)
const bulletOptions = computed(() =>
  ['disc', 'circle', 'square', 'dash', 'check', 'sparkle'].map((value) => ({ value, label: t(`products.markdown.bullets.${value}`) }))
)
const numbers = [
  { key: 'fontSize', min: 12, max: 24, step: 1 },
  { key: 'lineHeight', min: 1.2, max: 2.4, step: 0.1 },
  { key: 'paragraphSpacing', min: 0.5, max: 2, step: 0.1 },
  { key: 'headingScale', min: 1, max: 1.6, step: 0.05 }
] as const
const showMarkdown = ref(false)
const markdownSourceId = useId()
const sampleMarkdown = computed(() => {
  const sample = (key: string) => t(`products.markdown.${key}`)
  return [
    `## ${sample('sampleTitle')}`,
    `**${sample('sampleIntro')}**`,
    `### ${sample('sampleHeading')}`,
    `- ${sample('sampleItemOne')}\n- ${sample('sampleItemTwo')}`,
    `[${sample('sampleLink')}](#)`,
    `> ${sample('sampleQuote')}`,
    ...[1, 4, 5, 6].map((level) => `${'#'.repeat(level)} ${t('products.markdown.sampleLevel', { level })}`)
  ].join('\n\n')
})
const sampleHtml = computed(() => {
  const sample = (key: string) => t(`products.markdown.${key}`).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  return `<h2>${sample('sampleTitle')}</h2><p><strong>${sample('sampleIntro')}</strong></p><h3>${sample('sampleHeading')}</h3><ul><li>${sample('sampleItemOne')}</li><li>${sample('sampleItemTwo')}</li></ul><p><a href="#">${sample('sampleLink')}</a></p><blockquote>${sample('sampleQuote')}</blockquote>${[1, 4, 5, 6].map((level) => `<h${level}>${t('products.markdown.sampleLevel', { level })}</h${level}>`).join('')}`
})
const colors = ['textColor', 'headingColor', 'linkColor', 'backgroundColor', 'bulletColor', 'h1Color', 'h2Color', 'h3Color', 'h4Color', 'h5Color', 'h6Color'] as const
</script>

<template>
  <section class="space-y-4 border-t border-default pt-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-lg font-semibold">{{ t('products.markdown.title') }}</h2>
      <UButton type="button" color="neutral" variant="outline" @click="theme = defaultMarkdownStyle()">{{
        t('products.markdown.reset')
      }}</UButton>
    </div>
    <p class="text-sm text-muted">{{ t('products.markdown.help') }}</p>
    <div class="grid gap-6 xl:grid-cols-2">
      <div class="space-y-4">
        <UFormField name="markdownStyle.fontFamily" :label="t('products.markdown.fontFamily')">
          <USelect v-model="theme.fontFamily" :items="fontOptions" class="w-full" />
        </UFormField>
        <UFormField name="markdownStyle.bulletStyle" :label="t('products.markdown.bulletStyle')">
          <USelect v-model="theme.bulletStyle" :items="bulletOptions" class="w-full" />
        </UFormField>
        <p class="text-sm text-muted">{{ t('products.markdown.bulletHelp') }}</p>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            v-for="field in numbers"
            :key="field.key"
            :name="`markdownStyle.${field.key}`"
            :label="t(`products.markdown.${field.key}`)"
          >
            <UInputNumber
              v-model="theme[field.key]"
              :min="field.min"
              :max="field.max"
              :step="field.step"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-for="key in colors"
            :key="key"
            :name="`markdownStyle.${key}`"
            :label="t(`products.markdown.${key}`)"
          >
            <div class="flex items-center gap-2">
              <UInput v-model="theme[key]" :placeholder="t('products.markdown.automatic')" class="min-w-0 flex-1" />
              <UPopover :content="{ align: 'start' }">
                <UButton
                  type="button"
                  color="neutral"
                  variant="outline"
                  :aria-label="t('products.markdown.chooseColor', { field: t(`products.markdown.${key}`) })"
                >
                  <span
                    class="size-4 rounded-full border border-default"
                    :style="{ backgroundColor: theme[key] || undefined }"
                  >
                    <UIcon v-if="!theme[key]" name="i-lucide-pipette" class="size-3.5" />
                  </span>
                </UButton>
                <template #content>
                  <div class="space-y-3 p-4">
                    <p class="text-sm font-medium">{{ t(`products.markdown.${key}`) }}</p>
                    <UColorPicker :model-value="theme[key] || undefined" format="hex" @update:model-value="theme[key] = $event || ''" />
                    <UButton type="button" color="neutral" variant="outline" block @click="theme[key] = ''">
                      {{ t('products.markdown.useAutomatic') }}
                    </UButton>
                  </div>
                </template>
              </UPopover>
            </div>
          </UFormField>
        </div>
        <p class="text-sm text-muted">{{ t('products.markdown.colorHelp') }}</p>
        <p class="text-sm text-muted">{{ t('products.markdown.headingColorHelp') }}</p>
      </div>
      <div class="min-w-0 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h3 class="font-medium">{{ t('products.markdown.preview') }}</h3>
          <USwitch
            v-model="showMarkdown"
            :label="t('products.markdown.showMarkdown')"
            :aria-controls="markdownSourceId"
          />
        </div>
        <div class="rounded-lg border border-default p-5">
          <ProductsMarkdown :html="sampleHtml" :theme="theme" />
        </div>
        <pre v-if="showMarkdown" :id="markdownSourceId" class="whitespace-pre-wrap break-words rounded-lg border border-default bg-elevated p-4 text-sm"><code>{{ sampleMarkdown }}</code></pre>
      </div>
    </div>
  </section>
</template>
