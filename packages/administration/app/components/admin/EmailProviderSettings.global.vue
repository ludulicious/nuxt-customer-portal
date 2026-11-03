<script setup lang="ts">
import EmailProviderSection from './email/EmailProviderSection.vue'

const { data: settings } = await useAdminEmailSettings()
</script>

<template>
  <EmailProviderSection v-if="settings" :settings="settings" />
</template>
