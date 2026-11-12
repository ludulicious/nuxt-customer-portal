# Timesheets layer

An isolated PortalNuxt feature for weekly time entry, timers, approval, project configuration, tariffs, budgets, and reporting.

All API access is scoped to the active organization through portal-core. Feature-owned database objects live in the PostgreSQL `timesheets` schema.

The timesheet toolbar's week number and date range open a calendar week picker. Select any date to view its Monday–Sunday week, or use the previous/next buttons. The picker highlights the displayed week and is disabled while a timesheet is loading.

### Approval email history and reminders

Internal and provider client approval cards show approval request email history with the recipient name and address at send time, timestamp, message, and sending/sent/failed status. Sent means accepted by the email provider, not confirmed delivery or reading. Tracking begins with migration `0006_approval_email.sql`; earlier sends cannot be reconstructed.

Pending requests can be resent with an edited message. The editor starts with the currently configured approval email body in the client or portal email language, with timesheet details filled in. When sending to multiple approvers, the recipient name placeholder stays personalized per email. The edited body replaces the request email body; it is not inserted as a comment inside another template. The dialog lists the **current approvers**, who may differ from historical recipients. Internal resends require a currently assigned internal approver; client resends require a workspace owner or administrator. Recipients and approval version are checked again on submission. A resend does not change approval status or overwrite prior email messages.

### Client review requests

Client approval requests are sent manually from **Client approvals → Hours to send → Send request**. Submitting or internally approving a timesheet, disabling internal approvals, and reaching a review period boundary never create or send a client request. Client approval intervals determine how submitted weeks and partial weeks are grouped by work date; they do not change internal submission boundaries. Clients without an interval setting default to monthly. Explicit weekly, fortnightly, or monthly schedules retain their configured interval.

The provider’s Client approvals page defaults to the previous month and uses one selected month for both **Hours to send** and **Approval requests**. Requests are assigned by their work period, not their send date; periods spanning months appear in each relevant month. Links to a specific request open its work month automatically. Preparation only includes entries attached to submitted or internally approved timesheets; unsubmitted, draft, reopened, and rejected work does not appear or block other submitted work. It shows periods with unrequested or outstanding submitted time by default, with ready-to-send periods first. Enable **Show empty periods** to inspect the remaining periods. Blockers identify internal approval, missing reviewers, or a period that has not ended. The page always shows both monthly sections, including their empty states; it does not load or display the historical submission archive. Sending, withdrawing, correcting, and client decisions retain their existing rules.

Enable **Track hours** under **Clients → client → Modules** for clients that need time registration. This uses the existing Timesheets module setting; client access (view/review) remains separate. Clients with tracking disabled are excluded from new project choices and new time entry; existing hours and requests remain in the monthly approval view regardless of tracking status. Existing projects, recorded time, and sent requests remain available as history. New clients only participate when the module is explicitly enabled.

Client review intervals have a **Starting month** selected with the Nuxt UI month picker. A change is allowed only when that client has no recorded time or approval requests in that month or later. Drafts and future-dated time also protect their months. Eligibility is rechecked under the same client lock used for entry changes and request sending. Earlier schedules are preserved; unused schedules from the chosen month onward are replaced.

Workspace settings → Clients lists all active clients in searchable cards, with filters for tracking on or off. Provider owners and administrators use each client’s labelled Track hours switch to enable or disable tracking. For tracked clients, select the card or edit action to open access and approval interval/starting month settings inline. These controls use the same protected module-setting API as the Clients page and never delete clients or historical time.

Track hours controls new registration only. Turning it off does not filter existing monthly hours or approval requests. Existing hours may still be sent when client review access is enabled; when review access is disabled, the hours remain visible with an explanation.

The monthly view also reads earlier submission-based client decisions alongside period requests. Earlier records are split by work month for display, with their original statuses and recorded hours preserved. Earlier internally approved time is not listed again as unsent; unsubmitted drafts, reopened timesheets, and rejected timesheets are excluded from preparation and sending until submitted again. No historical records are migrated or rewritten.

Internally approved hours for clients with view-only or disabled client review access appear as **Auto approved** in the selected month, independently of Track hours. They are excluded from hours to send. Submitted time awaiting internal approval stays blocked; draft, reopened, and rejected time is excluded. Existing active requests retain their actual status.

The shared **Client** filter contains active clients with Track hours enabled and clients with recorded hours or requests in the selected month. It filters both monthly sections. **Show empty periods** only exposes empty periods for active tracked clients; recorded work remains visible independently of tracking or archive status. Periods follow the client's approval interval effective for the selected month, so monthly and weekly clients can appear together.

Month navigation remounts the review component inside Suspense. Requests and periods are awaited in setup with automatic fetch watching disabled; the previous prepared month stays mounted until the next month is ready. Filtering is computed from those datasets without manual watchers.

Workspace settings appears after Reports. General preferences, Clients, Team members, and Internal approval settings have separate tabs with icons; existing internal-approval settings and team-rate links redirect to their new tabs. The Timesheets sidebar entry remains available independently of internal approvals; only the internal approval queue depends on enabled approvals and assigned approvers. Changing the approval switch refreshes navigation immediately.
