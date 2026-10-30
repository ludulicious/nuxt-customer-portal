<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { resolveAuthBackgrounds, type AuthBackgroundBranding } from '../utils/auth-background'

const route = useRoute()
const { t } = useI18n()
const bootstrap = useState<{ adminExists?: boolean; completed?: boolean } | null>('portal-bootstrap-state', () => null)
const settings = useState<{ branding?: AuthBackgroundBranding } | null>('portal-runtime-settings', () => null)
const backgrounds = computed(() => resolveAuthBackgrounds(settings.value?.branding))
</script>

<template>
  <div class="auth-shell" :class="{ 'auth-shell--illustrated': backgrounds.desktop }">
    <picture v-if="backgrounds.desktop" class="auth-background" aria-hidden="true">
      <source media="(max-width: 1023px)" :srcset="backgrounds.mobile" />
      <img :src="backgrounds.desktop" alt="" fetchpriority="high" decoding="async" />
    </picture>
    <UPageCard variant="subtle" class="auth-card relative w-full max-w-sm shrink-0">
      <UAlert
        v-if="route.path === '/signup' && bootstrap && !bootstrap.adminExists"
        class="mb-5"
        color="info"
        variant="subtle"
        icon="i-lucide-shield-check"
        :title="t('saasSettings.bootstrap.title')"
        :description="t('saasSettings.bootstrap.description')"
      />
      <slot />
    </UPageCard>
  </div>
</template>

<style scoped>
.auth-shell {
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  padding: max(1.5rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right))
    max(1.5rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
}
.auth-background {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}
.auth-background img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center bottom;
}
.auth-card {
  z-index: 1;
}
.auth-shell--illustrated .auth-card {
  background: var(--ui-bg-elevated);
  box-shadow: 0 1.5rem 4.5rem color-mix(in srgb, var(--ui-text) 12%, transparent);
}
@media (max-width: 1023px) {
  .auth-shell {
    align-items: flex-start;
  }
}
@media (min-width: 1024px) {
  .auth-shell--illustrated {
    justify-content: flex-start;
    padding-inline: clamp(3rem, 12vw, 12rem);
  }
  .auth-background img {
    object-position: right center;
  }
}
</style>
