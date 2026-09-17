export default defineNuxtConfig({
  $meta: { name: 'nuxt-customer-portal-invoice-products' },
  compatibilityDate: '2025-10-24',
  nitro: {
    experimental: { tasks: true },
    scheduledTasks: { '* * * * *': ['invoice-products:emails'] }
  }
})
