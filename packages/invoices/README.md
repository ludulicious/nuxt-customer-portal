# `@nuxt-customer-portal/invoices`

Standalone sales and received invoicing for Nuxt Customer Portal. Add the optional
`@nuxt-customer-portal/invoice-timesheets` layer to create invoices from approved time.

Invoice email status is refreshed on opening an invoice only when an unresolved delivery is due for a check. Delivered, opened, clicked, bounced, failed, suppressed and complained messages are excluded from automatic checks. Unresolved messages are checked at most every five minutes during the first day, hourly after one day, and daily after a week. Failed lookup attempts observe the same cooldown while preserving the last known status. Concurrent requests claim each attempt in the database before contacting the provider.

Manual refresh can check resolved deliveries for later engagement or complaints, with a one-minute cooldown per message. These events are not updated automatically after delivery; receiving them continuously would require a Resend webhook integration.
