# Business and personal clients

Clients can represent organizations or private persons. Both retain a Better Auth organization as their access boundary, so existing module references and invoice history remain intact. `organizationType` still identifies PROVIDER versus CLIENT; `clientType` identifies organization versus person.

## Coaching portal configuration

```ts
export default definePortalConfig({
  clients: {
    allowedTypes: ['organization', 'person'],
    personalSelfRegistration: true,
    defaultModules: ['timesheets', 'invoices']
  },
  layers: [
    '@nuxt-customer-portal/preset',
    '@nuxt-customer-portal/timesheets',
    '@nuxt-customer-portal/invoices',
    '@nuxt-customer-portal/invoice-timesheets'
  ]
})
```

Pass `portal.clients` to `runtimeConfig.public.clients` in the host Nuxt configuration, as in the supplied apps. Set `PORTAL_REGISTRATION_MODE=open` for personal self-registration. Default modules must be installed and client-aware. For B2B-only portals omit the new options: allowed types default to `['organization']`, with personal registration disabled.

Configuration is validated at startup. A type cannot be disabled while clients of that type remain, including archived clients. Disable personal self-registration instead to stop new public signups while preserving existing accounts. Existing clients are migrated as organizations; type changes are not supported.

## Personal access

Provider owners and administrators can create a personal client without a login and invite the person later. Person profiles use a full name, invoice email, optional address, language, and optional timezone. Company registration and VAT fields do not apply.

The signup page offers an explicit private-client registration link. After email verification and login, `/personal-onboarding` collects the name, language, and timezone and creates the client with its default modules. Existing authenticated users can open personal onboarding from their profile settings. Company invitations continue through their existing flow and do not create personal clients.

`POST /api/personal-client` requires verified authentication and enabled personal registration. Its body is `{ name, preferredLocale: 'nl' | 'en', timezone: string | null }`. It atomically creates the client, one owner membership, and default module activations. Retries return the existing personal client without modifying its preferences. Database uniqueness protects competing invitations/onboarding requests. One login may have company memberships and one personal client. Personal users cannot manage members or invitations, including through direct Better Auth routes.

Accept invitations through `/api/organizations/accept-invitation`. A second personal account is rejected with a conflict; contact the coach to reconcile the records. Never automatically claim a client by its invoice email. The coach can remove a personal membership to correct access while retaining business history. There is no automated account merge.

## Timezones

- Provider timezone: shared organization settings, editable by provider owners/admins.
- Client timezone: optional override on a client profile. Null inherits from the provider.
- User timezone: optional saved preference. Null inherits from the active client's timezone, then the provider.

Store IANA zone identifiers, such as `Europe/Amsterdam` or `America/New_York`, rather than fixed offsets. The onboarding form suggests the current device timezone; settings offer an explicit “Use device timezone” action. Neither updates preferences without submitting the form. Travel does not silently change the saved timezone.

`GET /api/timezones` returns `providerTimezone`, `clientTimezone`, `userTimezone`, `schedulingTimezone`, and `displayTimezone` for the authenticated context. `PATCH /api/profile` accepts `{ timezone: string | null }`; `PATCH /api/provider-timezone` accepts `{ timezone: string }`. Client APIs expose `timezone` and the resolved `schedulingTimezone`.

Feature packages can use core's `shared/timezone` resolution and `server/utils/timezones` projections. Server code must authorize the requested user and client before exposing recipient-specific results. Always use the saved recipient preference for future appointment emails.

The additive migration initializes the provider timezone from existing Timesheets workspace settings, otherwise `Europe/Amsterdam`. Existing users and clients inherit. Timesheets retains its own timezone and date-boundary calculations; changing shared preferences does not modify Timesheets settings or historical invoices.

## Future appointments

Persist concrete start/end instants and the appointment's scheduling timezone. Display the same instant using each viewer's resolved timezone. Changing a profile preference must not move an appointment. Recurring appointments need a separate wall-clock recurrence model, with explicit policies for missing and repeated times during daylight-saving transitions. Appointment booking, recurrence, employer sponsorship, and shared personal accounts are not part of this change.

## Verification

Run package tests with `node --import tsx --test packages/*/test/*.test.ts`. The migration integration test requires `PORTAL_TEST_DATABASE_URL` pointing to a new empty disposable database whose name starts with `codex_clients_test_`; it installs its own fixture and migrations. Never point it at portal data.

The optional Playwright suite uses `test/e2e/personal-clients.config.ts`. It requires an isolated migrated portal at `http://localhost:4193` (override with `PORTAL_PERSONAL_E2E_URL`), both client types and personal registration enabled, and verified credential test accounts `coach@example.test` and `person@example.test` with password `Portal-test-password-2026!`. The coach must own provider organization ID `provider`. Run with `PORTAL_PERSONAL_E2E=1`. These credentials are test fixtures only.
