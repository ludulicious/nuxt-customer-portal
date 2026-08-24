<script setup lang="ts">
import type { PortalSettings } from '../../../shared/settings'

defineProps<{ state: PortalSettings }>()
const { t } = useI18n()
</script>

<template>
  <div class="review-grid">
    <div>
      <span>{{ t('saasSettings.editor.review.portal') }}</span
      ><strong>{{ state.branding.portalName }}</strong>
    </div>
    <div>
      <span>{{ t('saasSettings.editor.review.theme') }}</span
      ><strong>{{ state.appearance.theme }}</strong>
    </div>
    <div>
      <span>{{ t('saasSettings.editor.review.colorMode') }}</span
      ><strong>{{ state.appearance.colorMode }}</strong>
    </div>
    <div>
      <span>{{ t('saasSettings.editor.review.activeModules') }}</span
      ><strong>{{ state.enabledModules.length }}</strong>
    </div>
    <p>{{ t('saasSettings.editor.review.description') }}</p>
  </div>
</template>

<style scoped>
.review-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}
.review-grid div {
  display: grid;
  padding: 1rem;
  border: 1px solid var(--ui-border);
  border-radius: 0.65rem;
}
.review-grid span {
  color: var(--ui-text-muted);
  font-size: 0.8rem;
}
.review-grid p {
  grid-column: 1/-1;
}
@media (max-width: 768px) {
  .review-grid {
    grid-template-columns: 1fr;
  }
}
</style>
