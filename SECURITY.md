# Security policy

Do not report a suspected vulnerability through a public issue, pull request, documentation report, or other public channel.

## Reporting a vulnerability

Use private vulnerability reporting from the repository's [Security tab](https://github.com/ludulicious/customer-portal/security) when GitHub offers the **Report a vulnerability** action. If that action is unavailable, contact the repository owner through GitHub without including exploit details publicly, then agree on a private channel.

Include:

- the affected commit;
- impact and prerequisites;
- minimal reproduction steps using synthetic data;
- the affected authentication, authorization, tenant, module, or data boundary;
- a suggested mitigation, when known.

Never test against organizations, systems, or data that you do not own or have explicit permission to assess. Do not attach credentials, session cookies, `.env` files, database exports, invoices, personal timesheets, or real customer records.

## Scope

Reports involving authentication, authorization, active-organization isolation, system-administrator access, feature policies, file or document access, invoices, approvals, and time entries are in scope. A visible menu item without permission is worth reporting when it exposes data or an executable action; visual inconsistencies without security impact can use the bug form.

Vulnerabilities specific to the documentation site or its deployment belong to the [portalnuxt repository](https://github.com/ludulicious/portalnuxt/security).

## Supported versions and disclosure

Customer Portal is in active development and does not yet publish versioned releases or security-support windows. Pin deployed commits and review the [compatibility and release policy](https://portalnuxt.com/reference/compatibility-and-releases) before upgrading.

The project does not currently promise an acknowledgement or remediation time. Please allow maintainers a reasonable opportunity to investigate and coordinate a fix before any public disclosure.
