import { absoluteSiteUrl } from './site'

export type DocumentationCatalogEntry = {
  path: string
  title: string
  description: string
}
export const documentationCatalog: DocumentationCatalogEntry[] = [
  {
    path: '/getting-started',
    title: 'Introduction',
    description: 'Understand what Customer Portal provides, how it is structured, and where to begin.'
  },
  {
    path: '/getting-started/installation',
    title: 'Installation',
    description: 'Install the Nuxt Customer Portal packages, configure PostgreSQL, and run the provider migrations.'
  },
  {
    path: '/getting-started/usage',
    title: 'Configuration',
    description: 'Configure URLs, registration, authentication providers, email delivery, and administrator access.'
  },
  {
    path: '/getting-started/deployment',
    title: 'Deployment',
    description:
      'Build Customer Portal, apply migrations safely, configure its public origin, and verify a production release.'
  },
  {
    path: '/getting-started/ai-access',
    title: 'AI and machine-readable documentation',
    description: 'Use raw Markdown, llms.txt, and the documentation MCP server with AI development tools.'
  },
  {
    path: '/getting-started/customization',
    title: 'Customize and brand the portal',
    description: 'Build a host-owned shell while reusing neutral portal primitives and feature contributions.'
  },
  {
    path: '/architecture/overview',
    title: 'Architecture overview',
    description: 'How the thin host, portal core, and feature layers combine into one Customer Portal application.'
  },
  {
    path: '/architecture/layers',
    title: 'Nuxt layers',
    description: 'Compose official npm layers and local providers through the package-ready portal configuration.'
  },
  {
    path: '/architecture/core-contracts',
    title: 'Portal-core contracts',
    description: 'Navigation, modules, dashboard widgets, audiences, and policies exposed to feature layers.'
  },
  {
    path: '/architecture/tenancy-and-security',
    title: 'Tenancy and security',
    description: 'How Customer Portal scopes data, separates roles, and protects feature APIs.'
  },
  {
    path: '/architecture/database-migrations',
    title: 'Database migrations',
    description: 'Apply package-owned PostgreSQL migration providers safely and adopt the recognized legacy history.'
  },
  {
    path: '/modules/overview',
    title: 'Module overview',
    description: 'The foundation, optional business, and integration packages shipped with Nuxt Customer Portal.'
  },
  {
    path: '/modules/timesheets',
    title: 'Timesheets',
    description: 'Time entry, internal and client approvals, supplier collaboration, and reporting.'
  },
  {
    path: '/modules/invoices',
    title: 'Invoices',
    description: 'Standalone sales and received invoices with PDF, email, payment, and access workflows.'
  },
  {
    path: '/modules/service-requests',
    title: 'Service requests',
    description: 'A compact reference feature showing the complete Customer Portal layer lifecycle.'
  },
  {
    path: '/modules/platform-layers',
    title: 'Platform layers',
    description: 'Understand the reusable foundation packages, their ownership boundaries, and host-owned presentation.'
  },
  {
    path: '/reference',
    title: 'Reference',
    description: 'Look up Customer Portal configuration, feature contracts, server APIs, and compatibility guarantees.'
  },
  {
    path: '/reference/configuration',
    title: 'Configuration reference',
    description: 'Customer Portal environment variables, defaults, precedence, secrets, and production checks.'
  },
  {
    path: '/reference/feature-contract',
    title: 'Feature contract reference',
    description:
      'Exact Customer Portal registry fields for navigation, modules, widgets, audiences, and authorization policies.'
  },
  {
    path: '/reference/server-api',
    title: 'Server API and OpenAPI',
    description: 'Discover Customer Portal endpoints and build authenticated, tenant-scoped feature APIs.'
  },
  {
    path: '/reference/compatibility-and-releases',
    title: 'Compatibility and releases',
    description: 'Alpha package compatibility, linked versioning, migrations, and MIT licensing.'
  },
  {
    path: '/reference/glossary',
    title: 'Glossary',
    description:
      'Shared Customer Portal terminology for architecture, tenancy, modules, permissions, timesheets, and distribution.'
  },
  {
    path: '/reference/source-map',
    title: 'Product source map',
    description: 'Open the Nuxt Customer Portal monorepo files behind packages, demos, migrations, and boundary checks.'
  },
  {
    path: '/operations',
    title: 'Operations',
    description: 'Run, monitor, recover, and troubleshoot a production Customer Portal deployment.'
  },
  {
    path: '/operations/backup-and-restore',
    title: 'Backup and restore',
    description:
      'Back up Customer Portal data, protect sensitive archives, and verify recovery on an isolated PostgreSQL database.'
  },
  {
    path: '/operations/troubleshooting',
    title: 'Troubleshooting',
    description: 'Diagnose Customer Portal startup, database, authentication, email, and feature-layer problems.'
  },
  {
    path: '/operations/observability',
    title: 'Observability',
    description:
      'Monitor Customer Portal with its current runtime signals and establish a production reliability baseline.'
  },
  {
    path: '/operations/upgrade-recovery',
    title: 'Upgrade recovery',
    description:
      'Recover safely from failed Customer Portal migrations, startup failures, and post-release regressions.'
  },
  {
    path: '/guides',
    title: 'User guides',
    description:
      'Complete everyday Customer Portal tasks as a member, approver, client reviewer, or organization administrator.'
  },
  {
    path: '/guides/account-and-organizations',
    title: 'Accounts and organizations',
    description: 'Register, verify an account, accept invitations, switch organizations, and understand portal roles.'
  },
  {
    path: '/guides/dashboard',
    title: 'Use the dashboard',
    description:
      'Understand role-aware widgets, active-organization context, and the work Customer Portal brings to your attention.'
  },
  {
    path: '/guides/system-administration',
    title: 'Administer the portal',
    description:
      'Manage portal users, organizations, memberships, sessions, and feature access as a system administrator.'
  },
  {
    path: '/guides/service-requests',
    title: 'Use service requests',
    description: 'Create, find, update, and manage tenant-scoped service requests in Customer Portal.'
  },
  {
    path: '/guides/timesheet-setup',
    title: 'Set up a timesheet workspace',
    description:
      'Configure clients, activities, projects, team rates, approvals, and invoice defaults before work begins.'
  },
  {
    path: '/guides/time-entry',
    title: 'Record and submit time',
    description: 'Add weekly entries, use the running timer, correct rejected work, and submit a timesheet.'
  },
  {
    path: '/guides/approvals',
    title: 'Approve timesheets',
    description:
      'Configure internal approvers, review submitted weeks, and manage client approval or dispute workflows.'
  },
  {
    path: '/guides/timesheet-reporting',
    title: 'Report on recorded time',
    description: 'Filter, interpret, and export organization timesheet data for operational and financial follow-up.'
  },
  {
    path: '/guides/invoicing',
    title: 'Create and manage invoices',
    description:
      'Turn approved time into invoices, deliver PDFs and attachments, send reminders, and register payments.'
  },
  {
    path: '/contributing',
    title: 'Contributing',
    description:
      'Help improve Customer Portal through code, documentation, testing, design, and reusable feature layers.'
  },
  {
    path: '/contributing/create-a-layer',
    title: 'Create a feature layer',
    description:
      'Author a local Nuxt layer with public portal contracts, feature contributions, and its own migration provider.'
  },
  {
    path: '/contributing/distribute-a-layer',
    title: 'Distribute a feature layer',
    description:
      'Package a Nuxt layer with explicit exports, peers, manifests, migrations, and clean-consumer verification.'
  },
  {
    path: '/contributing/documentation',
    title: 'Documentation contributions',
    description: 'Write useful, verifiable Customer Portal documentation and preview it locally.'
  },
  {
    path: '/contributing/testing',
    title: 'Testing contributions',
    description:
      'Verify feature contracts, authorization, locales, migrations, UI behavior, and layer portability before review.'
  },
  {
    path: '/contributing/propose-a-module',
    title: 'Propose a module',
    description: 'Shape a reusable Customer Portal capability before investing in a new feature layer.'
  },
  {
    path: '/contributing/community',
    title: 'Community and support',
    description:
      'Choose the right Customer Portal channel for questions, bugs, documentation, module proposals, and security reports.'
  }
]

export function findDocumentation(query: string, limit = 8) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)

  return documentationCatalog
    .map((page) => {
      const title = page.title.toLocaleLowerCase()
      const path = page.path.toLocaleLowerCase()
      const description = page.description.toLocaleLowerCase()
      const score = terms.reduce(
        (total, term) =>
          total + (title.includes(term) ? 4 : 0) + (path.includes(term) ? 2 : 0) + (description.includes(term) ? 1 : 0),
        0
      )
      return { ...page, score }
    })
    .filter((page) => !terms.length || page.score > 0)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, limit)
    .map(({ score: _score, ...page }) => ({
      ...page,
      url: absoluteSiteUrl(page.path),
      markdownUrl: absoluteSiteUrl(`/raw${page.path}.md`)
    }))
}
