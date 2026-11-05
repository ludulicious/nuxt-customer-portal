---
'@nuxt-customer-portal/ui': patch
'@nuxt-customer-portal/saas-configuration': patch
---

Restore native Nuxt UI styling for the default portal theme. Remove hardcoded blue/slate palettes, gradients, shadow/overlay overrides, and shared field/button/menu variant replacements. Keep primary palettes responsive to configured light/dark brand colors while preserving native neutral surfaces, semantic status colors, and hover/focus behavior.

Make custom surface styling opt-in and keep live preview defaults isolated from the saved portal appearance. Preserve explicit editorial overrides and the separate Brutal theme. Add light/dark computed-style browser regressions against the installed Nuxt UI stylesheet.
