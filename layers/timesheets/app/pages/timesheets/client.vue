<script setup lang="ts">
const capabilities = await $fetch<{ canAccessApprovals: boolean, canEnterTime: boolean }>('/api/timesheets/capabilities')
const destination = capabilities.canAccessApprovals
  ? '/timesheets/approvals'
  : capabilities.canEnterTime
    ? '/timesheets'
    : '/dashboard'
await navigateTo(destination, { replace: true })
</script>

<template>
  <div />
</template>
