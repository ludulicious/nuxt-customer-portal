---
'@nuxt-customer-portal/saas-configuration': patch
'@nuxt-customer-portal/ui': patch
'@nuxt-customer-portal/authentication': patch
---

Redirect the portal home route to `/dashboard` instead of showing the public landing page. Preserve dashboard authentication, onboarding, and saved homepage content. Send portal logout directly to `/login` instead of the home route, and remove the home back button from authentication pages.

Use a neutral welcome heading on the sign-in page in English and Dutch so it also welcomes first-time visitors.

Show translated email and password prompts instead of technical validation errors when sign-in fields are empty or missing.
