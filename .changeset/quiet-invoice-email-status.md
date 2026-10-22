---
'@nuxt-customer-portal/invoices': patch
---

Avoid automatic provider lookups for resolved invoice email deliveries. Cache failed attempts, back off checks for older unresolved emails, and prevent duplicate concurrent lookups. Keep manual refresh available for later engagement and complaint events with a short cooldown.
