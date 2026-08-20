<template>
  <span class="saas-logo-mark" aria-hidden="true">
    <img
      src="/images/nuxt-customer-portal-logo-light.webp"
      alt=""
      width="48"
      height="48"
      decoding="async"
      class="dark:hidden"
    >
    <img
      src="/images/nuxt-customer-portal-logo-dark.webp"
      alt=""
      width="48"
      height="48"
      decoding="async"
      class="hidden dark:block"
    >
  </span>
</template>

<style scoped>
.saas-logo-mark {
  display: block;
  width: 3rem;
  height: 3rem;
}

.saas-logo-mark img {
  width: 3rem;
  height: 3rem;
  object-fit: contain;
}
</style>
