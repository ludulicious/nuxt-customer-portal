<script setup lang="ts">
import type { PortalSettings } from '../../../shared/settings'
import { applyAppearancePreset, portalFontNames } from '../../../shared/appearance'

const state = defineModel<PortalSettings>({ required: true })
const { t } = useI18n()
const fonts = computed(() =>
  portalFontNames.map((value) => ({
    value,
    label:
      value === 'theme'
        ? t('saasSettings.editor.appearance.themeDefault')
        : { playfair: 'Playfair Display', lato: 'Lato', geist: 'Geist', bricolage: 'Bricolage Grotesque' }[value]
  }))
)
const modes = computed(() =>
  state.value.appearance.colorMode === 'light-only'
    ? (['Light'] as const)
    : state.value.appearance.colorMode === 'dark-only'
      ? (['Dark'] as const)
      : (['Light', 'Dark'] as const)
)
const colors = ['secondary', 'background', 'surface'] as const
</script>

<template>
  <div class="preset-row">
    <div>
      <h3>{{ t('saasSettings.editor.appearance.presets') }}</h3>
      <p>{{ t('saasSettings.editor.appearance.presetHint') }}</p>
    </div>
    <div class="preset-actions">
      <UButton
        type="button"
        variant="outline"
        @click="state.appearance = applyAppearancePreset(state.appearance, 'soft-editorial')"
        >{{ t('saasSettings.editor.appearance.softEditorial') }}</UButton
      >
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        @click="state.appearance = applyAppearancePreset(state.appearance, 'theme')"
        >{{ t('saasSettings.editor.appearance.reset') }}</UButton
      >
    </div>
  </div>
  <UFormField name="appearance.headingFont" :label="t('saasSettings.editor.appearance.headingFont')"
    ><USelect v-model="state.appearance.headingFont" :items="fonts" class="w-full"
  /></UFormField>
  <UFormField name="appearance.bodyFont" :label="t('saasSettings.editor.appearance.bodyFont')"
    ><USelect v-model="state.appearance.bodyFont" :items="fonts" class="w-full"
  /></UFormField>
  <UFormField name="appearance.shape" :label="t('saasSettings.editor.appearance.shape')"
    ><USelect
      v-model="state.appearance.shape"
      :items="[
        { label: t('saasSettings.editor.appearance.themeDefault'), value: 'theme' },
        { label: t('saasSettings.editor.appearance.soft'), value: 'soft' }
      ]"
      class="w-full"
  /></UFormField>
  <UFormField
    name="appearance.headerBranding"
    :label="t('saasSettings.editor.appearance.headerBranding')"
    :description="t('saasSettings.editor.appearance.logoFallback')"
    ><USelect
      v-model="state.appearance.headerBranding"
      :items="[
        { label: t('saasSettings.editor.appearance.markName'), value: 'mark-name' },
        { label: t('saasSettings.editor.appearance.fullLogo'), value: 'full-logo' }
      ]"
      class="w-full"
  /></UFormField>
  <template v-for="color in colors" :key="color">
    <UFormField
      v-for="mode in modes"
      :key="mode"
      :name="`appearance.${color}${mode}`"
      :label="t(`saasSettings.editor.appearance.${color}${mode}`)"
    >
      <UInput
        v-model="state.appearance[`${color}${mode}`]"
        :placeholder="t('saasSettings.editor.appearance.themeDefault')"
        class="w-full"
        maxlength="7"
      >
        <template #leading
          ><span
            class="color-swatch"
            :style="{
              backgroundColor: /^#[0-9a-f]{6}$/i.test(state.appearance[`${color}${mode}`])
                ? state.appearance[`${color}${mode}`]
                : 'transparent'
            }"
        /></template>
      </UInput>
    </UFormField>
  </template>
  <PortalSettingsAppearancePreview :state="state" />
</template>

<style scoped>
.preset-row {
  grid-column: 1/-1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 0;
  border-bottom: 1px solid var(--ui-border);
}
.preset-row h3 {
  font-size: 1rem;
  font-weight: 600;
}
.preset-row p {
  font-size: 0.875rem;
  color: var(--ui-text-muted);
  max-width: 38rem;
}
.preset-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.color-swatch {
  display: block;
  width: 1rem;
  height: 1rem;
  border: 1px solid var(--ui-border);
  border-radius: 0.25rem;
}
</style>
