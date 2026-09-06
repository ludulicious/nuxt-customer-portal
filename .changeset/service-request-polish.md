---
'@nuxt-customer-portal/service-requests': patch
'@nuxt-customer-portal/ui': patch
---

Align customer and admin request lists with the portal collection toolbar, card layout, and fixed pagination footer. Preserve filters and sorting through detail navigation, support adjacent-page loading, and show scoped category choices independently of the current page.

Repair request editing and deletion confirmation, add localized form validation, and provide working admin status, priority, provider-team assignment, and internal-note controls.

Provide one request workspace with permission-aware management controls. Redirect legacy admin links while preserving collection state, and keep creation in the list header rather than the sidebar. Allow the dashboard body to shrink beneath the top bar so mobile pagination remains visible.
