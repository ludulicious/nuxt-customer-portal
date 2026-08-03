# Harvest-style timesheets feature layer

## Summary

Create an isolated `layers/timesheets` Nuxt layer following the existing portal-core contracts. The active organization is the internal workspace, its members are team members, and linked organization records are clients. The primary experience is fast weekly time entry with an optional running timer, followed by weekly submission and admin approval.

The interface retains the existing Nuxt UI design system and uses Harvest as a workflow reference, not a visual copy.

## Domain and persistence

- Workspace settings: ISO currency, IANA timezone, and Monday-based week start.
- Workspace-client links: many-to-many links from workspaces to organization records.
- Projects: client, code, dates, lifecycle, optional hours budget, and optional monetary budget.
- Activity types: billable flag, lifecycle, and project assignments.
- Team default tariffs and project-person tariff overrides.
- Time entries with integer minutes and snapshotted billable/rate/currency values.
- Weekly timesheets with draft, submitted, approved, and rejected states plus approval history.
- One running timer per workspace member.

Tariffs resolve in this order: project-person override, person default, then validation failure for billable time. Non-billable activity types always resolve to zero. Historical entries retain their snapshotted tariff and billability.

## Permissions and workflow

- Members manage, time, and submit only their own weeks.
- Owners and organization admins manage clients, projects, activity types, tariffs, reports, and approvals.
- Workspace identity is always derived from the authenticated active organization.
- Submitted and approved weeks are immutable.
- Rejection requires a comment and returns a week to editable work.
- Reopening an approved week is an explicit audited admin action.

## User experience

- `/timesheets`: weekly Monday–Sunday entry grid, timer, totals, and submission.
- `/admin/timesheets`: approvals, clients, projects, activity types, tariffs, budgets, and reports.
- Dashboard widget: current-week total, running timer, and submission state.
- English and Dutch translations.
- Desktop weekly grid and a compact day-focused mobile editor.

## Reporting

Authorized administrators can filter by date, client, project, person, activity, billability, and approval state. Reports show total hours, billable amount, non-billable hours, and budget consumption and can be exported as CSV.

## Acceptance criteria

- Tariff precedence, snapshotting, week boundaries, timer lifecycle, and approval transitions are covered by tests.
- Cross-workspace identifiers and unauthorized member access are rejected.
- Submitted and approved entries cannot be changed.
- Reports and CSV exports use identical filters and totals.
- English and Dutch locale structures match.
- Feature tests, lint, typecheck, build, and disposable PostgreSQL migration checks pass.

## Defaults and exclusions

- Currency defaults to EUR, timezone to `Europe/Amsterdam`, and week start to Monday.
- Manual time uses one-minute precision and optional notes.
- Budgets are informational and never block entry.
- Invoicing, expenses, utilization targets, capacity planning, and accounting integrations are outside v1.
