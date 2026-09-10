---
'@nuxt-customer-portal/administration': patch
'@nuxt-customer-portal/invoices': patch
'@nuxt-customer-portal/core': minor
'@nuxt-customer-portal/clients': minor
'@nuxt-customer-portal/authentication': minor
'@nuxt-customer-portal/organizations': minor
'@nuxt-customer-portal/kit': minor
'@nuxt-customer-portal/timesheets': patch
---

Support organization and personal clients with optional verified self-registration, single-person access safeguards, and shared provider, client, and user timezone preferences. Preserve existing B2B defaults, module references, invoice history, and Timesheets timezone behavior.

Collect and store first and last names during signup and personal onboarding. Route ordinary personal registration and verified users without memberships or pending invitations through onboarding.

Allow users to edit first name, last name, and an independent display name in profile settings.

Synchronize display-name edits with the linked private client name and current billing name in the same transaction, preserving organizations and historical invoices.

Let private clients edit their own billing address in profile settings, independently of the active organization, with server-side ownership checks.

Private clients use their own invoice email without contact persons; hide contact management and reject private-client contact creation or selection server-side.

Add a B2C-only Invite private client action to the Users page, supporting new and existing private clients with atomic record creation, request retry protection, and pending invitation recovery when email delivery fails.
