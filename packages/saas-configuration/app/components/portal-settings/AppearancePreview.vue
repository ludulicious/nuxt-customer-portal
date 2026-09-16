<script setup lang="ts">
import type { PortalSettings } from '../../../shared/settings'
import { resolveBrandAsset } from '../../../shared/settings'
import { appearanceVariables } from '../../../shared/appearance'
import { resolvePortalTheme } from '../../../shared/theme'

const props = defineProps<{ state: PortalSettings }>()
const { t } = useI18n()
const mode = ref('light')
const dark = computed(
  () =>
    props.state.appearance.colorMode === 'dark-only' ||
    (props.state.appearance.colorMode === 'user-choice' && mode.value === 'dark')
)
const theme = computed(() => resolvePortalTheme(props.state.appearance.theme))
const fullLogo = computed(() =>
  props.state.appearance.headerBranding === 'full-logo'
    ? resolveBrandAsset(props.state.branding, 'logo', dark.value)
    : ''
)
const logo = computed(() => fullLogo.value || resolveBrandAsset(props.state.branding, 'mark', dark.value))
const style = computed<Record<string, string>>((previous) => {
  try {
    return appearanceVariables(props.state.appearance, dark.value)
  } catch {
    return previous || {}
  }
})
</script>

<template>
  <section class="preview-section" :aria-label="t('saasSettings.editor.appearance.preview')">
    <div class="preview-toolbar">
      <div>
        <h3>{{ t('saasSettings.editor.appearance.preview') }}</h3>
        <p>{{ t('saasSettings.editor.appearance.previewHint') }}</p>
      </div>
      <USelect
        v-if="state.appearance.colorMode === 'user-choice'"
        v-model="mode"
        :aria-label="t('saasSettings.editor.appearance.previewMode')"
        :items="[
          { label: t('saasSettings.editor.appearance.light'), value: 'light' },
          { label: t('saasSettings.editor.appearance.dark'), value: 'dark' }
        ]"
      />
    </div>
    <div
      class="portal-appearance-preview"
      :class="dark ? 'dark' : 'light'"
      :style="style"
      :data-portal-theme="state.appearance.theme"
      :data-portal-surfaces="state.appearance.surfaceLight || state.appearance.surfaceDark ? 'custom' : 'theme'"
      :data-portal-shape="state.appearance.shape"
      :data-portal-heading-font="state.appearance.headingFont"
      :data-portal-body-font="state.appearance.bodyFont"
    >
      <UTheme :props="theme.props" :ui="theme.ui">
        <header class="preview-header">
          <img
            v-if="logo"
            :src="logo"
            :alt="state.branding.portalName"
            :class="fullLogo ? 'preview-logo' : 'preview-mark'"
          />
          <strong v-if="!fullLogo">{{ state.branding.portalName }}</strong>
        </header>
        <div class="preview-content">
          <nav>
            <span class="text-primary font-semibold">{{ t('saasSettings.editor.appearance.dashboard') }}</span
            ><span>{{ t('saasSettings.editor.appearance.account') }}</span>
          </nav>
          <h2>{{ t('saasSettings.editor.appearance.welcome') }}</h2>
          <p>{{ state.branding.tagline }}</p>
          <UCard class="portal-appearance-card">
            <h3>{{ t('saasSettings.editor.appearance.workspace') }}</h3>
            <p>{{ t('saasSettings.editor.appearance.sampleDescription') }}</p>
            <div class="preview-actions">
              <UButton type="button" tabindex="-1">{{ t('saasSettings.editor.appearance.primaryAction') }}</UButton>
              <span class="preview-accent">{{ t('saasSettings.editor.appearance.secondaryAccent') }}</span>
            </div>
          </UCard>
        </div>
      </UTheme>
    </div>
  </section>
</template>

<style scoped>
.preview-section {
  grid-column: 1 / -1;
  min-width: 0;
}
.preview-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}
.preview-toolbar h3 {
  font-size: 1rem;
  font-weight: 600;
}
.preview-toolbar p {
  font-size: 0.875rem;
  color: var(--ui-text-muted);
}
.portal-appearance-preview {
  border: 1px solid var(--ui-border);
  border-radius: 0.75rem;
  overflow: hidden;
  background: var(--ui-bg);
  color: var(--ui-text);
  font-family: var(--font-sans);
}
.preview-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--ui-border);
  background: var(--portal-surface, var(--ui-bg));
  color: var(--portal-surface-ink, var(--ui-text));
}
.preview-logo {
  height: 3rem;
  max-width: 12rem;
  object-fit: contain;
}
.preview-mark {
  width: 2.5rem;
  height: 2.5rem;
  object-fit: contain;
}
.preview-content {
  padding: clamp(1rem, 3vw, 2rem);
}
.preview-content nav {
  display: flex;
  gap: 1.5rem;
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
}
.preview-content h2 {
  font-size: 1.75rem;
  line-height: 1.2;
  margin-bottom: 0.5rem;
}
.preview-content h3 {
  font-size: 1.25rem;
  margin-bottom: 0.5rem;
}
.preview-content p {
  margin-bottom: 1.25rem;
}
.preview-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
}
.preview-accent {
  color: var(--ui-secondary);
  font-size: 0.875rem;
}
</style>
