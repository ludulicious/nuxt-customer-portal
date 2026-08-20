<script setup lang="ts">
const { t } = useI18n()

</script>

<template>
  <USeparator
    class="h-px"
  />

  <UFooter class="portal-footer" :ui="{ top: 'border-b border-default' }">
    <template #left>
      <p class="text-muted text-sm">
        © {{ new Date().getFullYear() }}. {{ t('footer.copyright') }}
      </p>
    </template>

    <template #right>
      <UButton
        :label="t('footer.privacy')"
        to="/privacy-policy"
        color="neutral"
        variant="ghost"
      />
      <UButton
        :label="t('footer.terms')"
        to="/terms-of-service"
        color="neutral"
        variant="ghost"
      />
    </template>
  </UFooter>
</template>
