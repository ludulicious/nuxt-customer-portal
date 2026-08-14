<script setup lang="ts">
const capabilities = await $fetch<{ canAccessApprovals: boolean, canEnterTime: boolean, canViewSupplierTime: boolean }>('/api/timesheets/capabilities')
const destination = capabilities.canAccessApprovals
  ? '/timesheets/approvals'
  : capabilities.canEnterTime
    ? '/timesheets'
    : capabilities.canViewSupplierTime
      ? '/timesheets/suppliers'
      : '/dashboard'
await navigateTo(destination, { replace: true })
</script>

<template>
  <div />
</template>
