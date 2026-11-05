---
'@nuxt-customer-portal/invoices': patch
'@nuxt-customer-portal/core': patch
'@nuxt-customer-portal/products': patch
---

Allow adding, editing, and removing draft invoice lines with validated quantities, prices, VAT, and live totals. Preserve existing line identities and exact tax amounts when unchanged, protect agreed purchase totals, and keep failed saves open. Restore direct New invoice navigation and allow manual creation even when optional invoice sources fail, with visible initialization errors and retry actions.

Share a sortable line list between invoice creation and editing, with only the selected line's edit fields open. Reuse the media library's drag sorting, live order preview, and automatic edge scrolling through a shared Core composable. Keep keyboard reordering without separate move buttons, focus the description after adding a line, reopen invalid lines on submission, and explicitly display VAT rates as percentages.

Open newly duplicated invoices and credit notes directly in draft edit mode.
