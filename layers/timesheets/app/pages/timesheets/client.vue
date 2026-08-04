<script setup lang="ts">
const capabilities = await $fetch<{ canAccessApprovals: boolean, canEnterTime: boolean, canViewSupplierTime: boolean, canViewClientInvoices: boolean }>('/api/timesheets/capabilities')
const destination = capabilities.canAccessApprovals
  ? '/timesheets/approvals'
  : capabilities.canEnterTime
    ? '/timesheets'
    : capabilities.canViewClientInvoices
      ? '/timesheets/invoices'
    : capabilities.canViewSupplierTime
      ? '/timesheets/suppliers'
      : '/dashboard'
await navigateTo(destination, { replace: true })
</script>

<template>
  <div />
</template>
