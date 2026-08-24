<script setup lang="ts">
const { t } = useI18n()
useSeoMeta({ title: () => t('saasSettings.title') })
</script>

<template><PortalSettingsEditor /></template>
