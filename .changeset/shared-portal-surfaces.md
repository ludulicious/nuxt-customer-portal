---
'@nuxt-customer-portal/ui': patch
'@nuxt-customer-portal/saas-configuration': patch
'@nuxt-customer-portal/administration': patch
'@nuxt-customer-portal/products': patch
---

Centralize portal surface styling so cards, inputs, rich-text editors, dialogs, and menus use the configured surface in both light and dark mode. Use Nuxt UI theme overrides and Tailwind rounding utilities while preserving native size variants and input padding. Keep neutral outline actions transparent and preserve branded selection states and the Brutal theme. Remove page-specific input background overrides and simplify nested Products form sections.
