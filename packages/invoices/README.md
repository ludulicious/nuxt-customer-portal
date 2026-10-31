# `@nuxt-customer-portal/invoices`

Standalone sales and received invoicing for Nuxt Customer Portal. Add the optional
`@nuxt-customer-portal/invoice-timesheets` layer to create invoices from approved time.

Sales invoice details retain the list return URL, including search, filters, sorting, direction, and page. Returning with the invoice's Back link or browser history restores the loaded page window and scroll position after fetching fresh list data. Position snapshots contain only pagination and scroll metadata and are scoped to the current user, organization, and list URL in session storage. Changing collection controls resets the list to page 1 and the top; browser Back/Forward rehydrates those controls from the URL. Links opened directly still return to the default invoice list, and invoices opened from orders retain their order-list return path.

Invoice email status is refreshed on opening an invoice only when an unresolved delivery is due for a check. Delivered, opened, clicked, bounced, failed, suppressed and complained messages are excluded from automatic checks. Unresolved messages are checked at most every five minutes during the first day, hourly after one day, and daily after a week. Failed lookup attempts observe the same cooldown while preserving the last known status. Concurrent requests claim each attempt in the database before contacting the provider.

Manual refresh can check resolved deliveries for later engagement or complaints, with a one-minute cooldown per message. These events are not updated automatically after delivery; receiving them continuously would require a Resend webhook integration.
