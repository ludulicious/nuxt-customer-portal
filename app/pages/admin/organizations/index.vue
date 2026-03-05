<script setup lang="ts">
const userStore = useUserStore()
const { isAdmin } = storeToRefs(userStore)

if (!isAdmin.value) {
  throw createError({ statusCode: 403, message: 'Admin access required' })
}
</script>

<template>
  <div>
    <AdminOrganizations />
  </div>
</template>
