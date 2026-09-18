<script setup lang="ts">
import type { PortalSettings } from '../../../shared/settings'
import {
  activeAppearancePreset,
  applyAppearancePreset,
  portalFontNames,
  type PortalAppearancePreset
} from '../../../shared/appearance'

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
const activePreset = computed(() => activeAppearancePreset(state.value.appearance))
const presets = computed<{ value: PortalAppearancePreset; label: string; description: string }[]>(() => [
  {
    value: 'business',
    label: t('saasSettings.editor.appearance.business'),
    description: t('saasSettings.editor.appearance.businessDescription')
  },
  {
    value: 'soft-editorial',
    label: t('saasSettings.editor.appearance.softEditorial'),
    description: t('saasSettings.editor.appearance.softEditorialDescription')
  }
])

function applyPreset(preset: PortalAppearancePreset) {
  state.value.appearance = applyAppearancePreset(state.value.appearance, preset)
}
</script>

<template>
  <section class="appearance-section style-section">
    <div class="section-copy">
      <h3>{{ t('saasSettings.editor.appearance.presets') }}</h3>
      <p>{{ t('saasSettings.editor.appearance.presetHint') }}</p>
    </div>
    <div class="style-options" role="group" :aria-label="t('saasSettings.editor.appearance.presets')">
      <button
        v-for="preset in presets"
        :key="preset.value"
        type="button"
        :class="['style-option', { 'style-option--active': activePreset === preset.value }]"
        :aria-pressed="activePreset === preset.value"
        @click="applyPreset(preset.value)"
      >
        <span class="style-option__marker" aria-hidden="true" />
        <span
          ><strong>{{ preset.label }}</strong
          ><small>{{ preset.description }}</small></span
        >
      </button>
    </div>
  </section>
  <section class="appearance-section controls-section">
    <div class="section-copy">
      <h3>{{ t('saasSettings.editor.appearance.common') }}</h3>
      <p>{{ t('saasSettings.editor.appearance.commonHint') }}</p>
    </div>
    <div class="control-grid">
      <UFormField name="appearance.colorMode" required :label="t('saasSettings.editor.fields.colorMode')">
        <USelect
          v-model="state.appearance.colorMode"
          :items="[
            { label: t('saasSettings.editor.colorModes.userChoice'), value: 'user-choice' },
            { label: t('saasSettings.editor.colorModes.lightOnly'), value: 'light-only' },
            { label: t('saasSettings.editor.colorModes.darkOnly'), value: 'dark-only' }
          ]"
          class="w-full"
        />
      </UFormField>
      <UFormField
        v-if="state.appearance.colorMode !== 'dark-only'"
        name="appearance.primaryLight"
        required
        :label="t('saasSettings.editor.fields.primaryLight')"
      >
        <UInput v-model="state.appearance.primaryLight" type="color" class="w-full" />
      </UFormField>
      <UFormField
        v-if="state.appearance.colorMode !== 'light-only'"
        name="appearance.primaryDark"
        required
        :label="t('saasSettings.editor.fields.primaryDark')"
      >
        <UInput v-model="state.appearance.primaryDark" type="color" class="w-full" />
      </UFormField>
    </div>
  </section>
  <section class="appearance-section advanced-section">
    <div class="section-copy">
      <h3>{{ t('saasSettings.editor.appearance.advanced') }}</h3>
      <p>{{ t('saasSettings.editor.appearance.advancedHint') }}</p>
    </div>
    <div class="control-grid">
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
    </div>
  </section>
  <section class="appearance-section preview-section">
    <PortalSettingsAppearancePreview :state="state" />
  </section>
</template>

<style scoped>
.appearance-section {
  grid-column: 1/-1;
  min-width: 0;
}
.appearance-section + .appearance-section {
  padding-top: 1.5rem;
  border-top: 1px solid var(--ui-border);
}
.section-copy {
  margin-bottom: 1rem;
}
.section-copy h3 {
  font-size: 1rem;
  font-weight: 700;
}
.section-copy p {
  font-size: 0.875rem;
  color: var(--ui-text-muted);
  max-width: 38rem;
}
.style-options,
.control-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}
.style-option {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.75rem;
  width: 100%;
  padding: 1rem;
  border: 1px solid var(--ui-border);
  border-radius: 0.5rem;
  background: var(--ui-bg);
  text-align: left;
}
.style-option:hover,
.style-option--active {
  border-color: var(--portal-primary);
  background: var(--ui-bg-muted);
}
.style-option:active {
  background: var(--ui-bg-accented);
}
.style-option:focus-visible {
  outline: 2px solid var(--portal-primary);
  outline-offset: 2px;
}
.style-option:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.style-option__marker {
  width: 1rem;
  height: 1rem;
  margin-top: 0.15rem;
  border: 1px solid var(--ui-border-accented);
  border-radius: 999px;
}
.style-option--active .style-option__marker {
  border: 0.3rem solid var(--portal-primary);
}
.style-option strong,
.style-option small {
  display: block;
}
.style-option small {
  margin-top: 0.25rem;
  color: var(--ui-text-muted);
  font-size: 0.8rem;
}
.color-swatch {
  display: block;
  width: 1rem;
  height: 1rem;
  border: 1px solid var(--ui-border);
  border-radius: 0.25rem;
}
@media (max-width: 768px) {
  .style-options,
  .control-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
