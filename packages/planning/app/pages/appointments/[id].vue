<script setup lang="ts">
const route = useRoute(),
  { t } = useI18n()
</script>

<template>
  <div class="h-full min-h-0 overflow-y-auto">
    <UContainer class="max-w-3xl space-y-5 py-8"
      ><UButton to="/appointments" variant="link">{{ t('planning.back') }}</UButton
      ><PlanningAppointmentDetails :id="String(route.params.id)" :key="String(route.params.id)"
    /></UContainer>
  </div>
</template>
