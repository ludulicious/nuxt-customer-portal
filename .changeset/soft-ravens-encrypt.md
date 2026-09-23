---
'@nuxt-customer-portal/core': minor
'@nuxt-customer-portal/products': minor
'@nuxt-customer-portal/planning': minor
'@nuxt-customer-portal/kit': minor
---

Add a single base64-encoded `PORTAL_ENCRYPTION_KEY` that derives isolated keys for credentials saved by Portal Core, Products, and Planning. Existing module-specific keys remain supported as overrides and can decrypt their legacy ciphertext formats.
