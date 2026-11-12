# Timesheets layer

An isolated PortalNuxt feature for weekly time entry, timers, approval, project configuration, tariffs, budgets, and reporting.

All API access is scoped to the active organization through portal-core. Feature-owned database objects live in the PostgreSQL `timesheets` schema.

The timesheet toolbar's week number and date range open a calendar week picker. Select any date to view its Monday–Sunday week, or use the previous/next buttons. The picker highlights the displayed week and is disabled while a timesheet is loading.

### Approval email history and reminders

Internal and provider client approval cards show approval request email history with the recipient name and address at send time, timestamp, message, and sending/sent/failed status. Sent means accepted by the email provider, not confirmed delivery or reading. Tracking begins with migration `0006_approval_email.sql`; earlier sends cannot be reconstructed.

Pending requests can be resent with an edited message. The editor starts with the currently configured approval email body in the client or portal email language, with timesheet details filled in. When sending to multiple approvers, the recipient name placeholder stays personalized per email. The edited body replaces the request email body; it is not inserted as a comment inside another template. The dialog lists the **current approvers**, who may differ from historical recipients. Internal resends require a currently assigned internal approver; client resends require a workspace owner or administrator. Recipients and approval version are checked again on submission. A resend does not change approval status or overwrite prior email messages.

### Client review requests

The provider’s Client approvals page defaults to the previous month and uses one selected month for both **Hours to send** and **Approval requests**. Requests are assigned by their work period, not their send date; periods spanning months appear in each relevant month. Links to a specific request open its work month automatically. Preparation shows periods with unrequested or outstanding time by default, with ready-to-send periods first. Enable **Show empty periods** to inspect the remaining periods. Blockers identify internal approval, missing reviewers, or a period that has not ended. The page always shows both monthly sections, including their empty states; it does not load or display the historical submission archive. Sending, withdrawing, correcting, and client decisions retain their existing rules.

Enable **Track hours** under **Clients → client → Modules** for clients that need time registration. This uses the existing Timesheets module setting; client access (view/review) remains separate. Clients with tracking disabled are excluded from new project choices and new time entry; existing hours and requests remain in the monthly approval view regardless of tracking status. Existing projects, recorded time, and sent requests remain available as history. New clients only participate when the module is explicitly enabled.

Client review intervals can apply from **This month** when that client has no active review requests overlapping the month. Pending, approved, and disputed requests protect their periods; withdrawn requests do not. **Next month** remains available and is the default. Eligibility is checked again while saving under the same client lock used when sending requests. Weekly internal approvals and earlier review periods remain unchanged. The month navigation uses Nuxt UI previous/next buttons and a month-selection popover.

The approvals page also lists active hour-tracking clients as tags, independently of the selected month. Provider owners and administrators can add an existing active client to enable tracking or remove its tag to disable tracking. These controls use the same protected module-setting API as the Clients page and never delete clients or historical time.

Track hours controls new registration only. Turning it off does not filter existing monthly hours or approval requests. Existing hours may still be sent when client review access is enabled; when review access is disabled, the hours remain visible with an explanation.

The monthly view also reads earlier submission-based client decisions alongside period requests. Earlier records are split by work month for display, with their original statuses and recorded hours preserved. Earlier internally approved time is not listed again as unsent; unsubmitted time remains visible with its submission/approval blocker. No historical records are migrated or rewritten.
