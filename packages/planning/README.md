# Planning

Optional service-product scheduling for Nuxt Customer Portal. Requires `products` and its dependencies; paid commerce also requires the existing invoice-products integration. This extension builds on products issue #22 / PR #23.

## Installation

Add `@nuxt-customer-portal/planning` as a dependency and to `portal.config.ts` after `products` and before running the portal migration command:

```ts
layers: [
  '@nuxt-customer-portal/preset',
  '@nuxt-customer-portal/products',
  '@nuxt-customer-portal/invoice-products',
  '@nuxt-customer-portal/planning'
]
```

The migration requires permission to install PostgreSQL's `btree_gist` extension. It adds scheduling tables and a provider/time exclusion constraint. Existing products default to ordinary checkout until explicitly marked plannable. Existing product JSON requires no backfill. Removing the planning layer prevents checkout and processing of plannable services; retain it while appointments or payment operations are outstanding.

Run Nitro's scheduled tasks every minute in production. HTTP deployments need a reachable HTTPS public URL for Google change notifications. Calendar checks remain live on booking requests; a five-minute polling fallback detects external conflicts and repairs portal mirrors when notifications are unavailable. Ensure only trusted proxy headers determine public API client IPs.

## Credentials and setup

Use dedicated Google and Zoom OAuth applications, separate from portal sign-in applications:

```dotenv
PLANNING_ENCRYPTION_KEY=<base64-encoded 32-byte random key>
PLANNING_GOOGLE_CLIENT_ID=
PLANNING_GOOGLE_CLIENT_SECRET=
PLANNING_ZOOM_CLIENT_ID=
PLANNING_ZOOM_CLIENT_SECRET=
```

Generate the encryption key with `openssl rand -base64 32`. Keep this key stable and backed up with the encrypted database. OAuth tokens are encrypted with AES-256-GCM and never returned through setup APIs.

Register redirect URLs using the portal's configured public origin:

- `/api/planning/oauth/google/callback`
- `/api/planning/oauth/zoom/callback`

For local Google development use `http://localhost:3052`. Zoom requires the portal's configured public origin to be reachable over HTTPS; a local reverse proxy with a stable HTTPS hostname can forward to `http://localhost:3052`. Register the standard `/api/planning/oauth/zoom/callback` path on that hostname. Google authorization requests Calendar events, Calendar list read access, free/busy access, and identity/email. Configure the Zoom user-managed application to list/read/create/update/delete the authorized user's meetings and add Users → Get a user (`user:read:user`) so the portal can identify the connected account. Use the user-level granular scopes, without the `:admin` variants. Enable appropriate test users or publish/verify the provider applications before connecting other users. Zoom account meeting limits still apply.

In hosts using SaaS configuration, enable the Planning module alongside Products. Admins enable planning per organization member at `/admin/planning`. Providers connect accounts, choose calendars, timezone and after-appointment grace time, and create availability at `/availability`. Choose several calendars for conflicts and one writable calendar; the writable calendar is automatically included in conflict checks. Assign providers to a service in the existing product editor and supply a positive duration. A product may be free, and may require Zoom or have no online meeting.

## Availability and reservations

Availability supports individual windows and weekly series, end dates, skipped occurrences, and edits to one occurrence or the entire series. Windows apply to all assigned plannable products, including future assignments, or to selected products. UTC slot iteration preserves duration across daylight-saving changes and presents repeated wall times with timezone information.

Changing a provider's scheduling timezone keeps availability at its configured local wall times in the new timezone. Confirmed appointments retain their original UTC instants and timezone snapshots. Product and grace-time changes likewise do not alter confirmed appointments.

Google availability mirrors are free events; confirmed appointments are busy events with the grace time described. Customer checkout holds remain internal. Portal mirrors are managed from the portal; external edits/removals are repaired and reported to the provider. Personal Google events get no additional grace time. New conflicts preserve confirmed bookings and alert their provider.

Catalog products expose `planningEnabled`, `durationMinutes`, and the existing `purchaseUrl`, which points to `/store/{slug}/book` for plannable services. Customers choose their timezone, any available provider or a named provider, then a slot. Exactly one appointment product, quantity one, is supported per checkout.

The default hold is **60 minutes from selection**, configurable by organization policy/product override. Its opaque credential is bound to an HTTP-only browser cookie. Changing browsers requires selecting another slot. Stripe checkout does not extend the hold: its minimum session lifetime can exceed the remaining reservation time, so scheduled tasks explicitly close it at the original deadline. Payment completion timestamps come from verified Stripe events or authoritative success-event reconciliation, rather than webhook delivery time. Late payments never reclaim released inventory and are refunded through durable jobs. Appointment checkout currently uses card payments. Free products confirm after checkout without Stripe.

Calendar API failure closes new availability and retries paid-order processing. Google and PostgreSQL cannot be atomically locked together; conflicts appearing after confirmation are flagged for provider resolution.

## Appointment management and policies

Guest customers sign in or verify a portal account and claim purchases by verified email before managing appointments at `/appointments`. Other users cannot manage those appointments.

Organization defaults can be overridden per product. Defaults: 60-minute hold, 15-minute start intervals, 90-day horizon, 24-hour booking notice, one free completed change, 24-hour change cutoff, and cancellation disabled. Configure a positive change fee in each supported booking currency to enable changes after the allowance. Monetary storage uses integer minor units; the policy UI displays currency amounts.

Customers may change to any currently eligible provider for the same product. The original appointment remains confirmed until replacement checkout succeeds. Free changes still require checkout; paid changes use a separate fee order and invoice. Failed/expired changes preserve the original and do not consume the allowance. Existing appointment duration and policy remain fixed. Reschedule/cancellation cutoffs are evaluated before accepting the customer action.

Cancellation must be explicitly enabled. Configure one notice cutoff and a refund percentage. Cancellation releases internal occupancy immediately and updates the calendar invitation and meeting through retryable tasks. Refunds cover the original appointment purchase, excluding separately earned change fees, capped by its remaining refundable balance. Refund failures do not undo cancellation. Reconciliation preserves invoice/credit-note behavior through the existing commerce integration.

Appointment invites keep their UID, organizer and incrementing sequence across changes and cancellations. Meetings, mirror updates and email use retryable jobs and stable identifiers. Admins can see appointments, conflicts and outstanding synchronization/refund jobs, and retry them at `/admin/planning`. The database retains an audit trail and permanent reservation confirmation evidence so replaying an original purchase never reverses a later reschedule or cancellation.

## APIs and adapters

Public portal-origin booking mutations:

- `GET /api/store/planning/{productId}/availability?from=...&to=...`
- `POST /api/store/planning/holds`
- `DELETE /api/store/planning/hold` releases a session-bound hold before an order is created. Checkout waits for this release before returning to time selection. A new hold can supply `previousHoldToken` to atomically replace an unbound hold for the same product; failed slot validation rolls back the replacement. Browser-back/abandoned holds otherwise expire normally.
- `GET /api/store/planning/hold?holdToken=...`
- Existing `POST /api/store/checkout`, extended with `holdToken`.

Provider/session APIs under `/api/planning` manage account connections, selected calendars, settings and availability. Verified customer APIs under `/api/planning/appointments` list, quote changes, expose replacement availability, and cancel appointments. Organization administrator APIs under `/api/planning/admin` manage provider switches/policy and expose appointments/jobs.

`CalendarAdapter`, `MeetingAdapter`, and `registerPlanningAdapters` provide provider-neutral extension seams. `PlanningOrderIntegration` links checkout validation, reservation binding, pre-confirmation calendar checks and transactional confirmation to products. External provider API operations run outside database transactions.

## Verification

```sh
node --import tsx --test packages/planning/test/planning.test.ts
PLANNING_TEST_DATABASE_URL=postgresql://.../portal_planning_test node --import tsx --test packages/planning/test/database.test.ts
```

The database test requires an empty disposable database named `portal_planning_test` or `portal_planning_test_<suffix>` and applies actual core, client, product and planning migrations. It uses real portal authentication and PostgreSQL, with Google/Zoom/Stripe/email fixtures that never send external requests. Recreate the disposable database before rerunning.

Before enabling live booking, connect Google/Zoom test accounts and verify consent/refresh, selected-calendar permissions, notification renewal, availability mirrors, real busy events, meeting creation and invitation delivery. These require provider credentials and approved test accounts; fixtures do not replace that deployment verification.

### Appointment administration

The Appointments menu includes the appointment collection, provider availability, and planning settings. Active members of the provider organization can view its appointments; organization owners and admins can reschedule or cancel them. Customers can view and manage only their own claimed purchases, subject to the policy recorded at booking. Staff reschedules preserve the customer change allowance. Cancellation retains order and appointment history, and refunds remain subject to eligibility. New appointments use booking and checkout.

Planning settings use separate components for the Team members, Booking policy, and Synchronization tabs, with the same tab styling as Store settings.

Personal connections and preferences are managed under My appointment settings (`/planning/settings`): Calendar settings contains Google connection, timezone, grace time, and calendar selection; Meeting settings contains the Zoom connection. Availability (`/availability`) contains only the availability editor and appointment blocks.

Sandbox bookings use internal availability, holds, and appointments without requiring Google or Zoom connections or external calendar conflict checks. Live bookings still require healthy connections and configured calendars.
