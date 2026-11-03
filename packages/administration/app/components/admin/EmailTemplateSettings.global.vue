<script setup lang="ts">
import EmailTemplateSection from './email/EmailTemplateSection.vue'

const { data: settings } = await useAdminEmailSettings()
</script>

<template>
  <EmailTemplateSection v-if="settings" :settings="settings" />
</template>
