---
'@nuxt-customer-portal/core': minor
'@nuxt-customer-portal/administration': minor
'@nuxt-customer-portal/products': minor
---

Replace the Products-specific API key implementation with organization-owned Better Auth API keys. Restrict key ownership and use to the provider organization, restrict administration to system administrators, and let modules declare the API scopes administrators can assign.

Move API-key management from Products store settings to a dedicated system Administration page.
