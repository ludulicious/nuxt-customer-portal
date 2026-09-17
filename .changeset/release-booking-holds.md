---
'@nuxt-customer-portal/planning': patch
'@nuxt-customer-portal/products': patch
---

Release unpaid booking holds before returning to time selection. Atomically replace the previous hold when choosing another time in the same tab, preserving it if the new slot cannot be reserved. Session-bound credentials cannot release confirmed bookings or holds attached to an order.
