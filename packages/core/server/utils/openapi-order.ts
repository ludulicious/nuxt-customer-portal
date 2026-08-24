type OpenApiOperation = Record<string, unknown>
type OpenApiPathItem = Record<string, OpenApiOperation>

export interface OpenApiDocument {
  paths?: Record<string, OpenApiPathItem>
  [key: string]: unknown
}

const METHOD_ORDER = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace']

const timesheetsSectionRank = (path: string): number => {
  if (path === '/api/timesheets/bootstrap') {
    return 0
  }
  if (path.includes('/api/timesheets/timer')) {
    return 10
  }
  if (path.includes('/api/timesheets/entries')) {
    return 20
  }
  if (path.includes('/api/timesheets/weeks')) {
    return 30
  }
  if (path.includes('/api/timesheets/admin/bootstrap')) {
    return 40
  }
  if (path.includes('/api/timesheets/admin/approvals')) {
    return 100
  }
  if (path.includes('/api/timesheets/admin/clients') || path.includes('/api/timesheets/admin/organizations')) {
    return 200
  }
  if (path.includes('/api/timesheets/admin/projects')) {
    return 300
  }
  if (path.includes('/api/timesheets/admin/activities')) {
    return 400
  }
  if (path.includes('/api/timesheets/admin/tariffs')) {
    return 600
  }
  if (path.includes('/api/timesheets/admin/settings') || path.includes('/api/timesheets/admin/email-domain')) {
    return 700
  }
  if (path.includes('/api/timesheets/admin/report')) {
    return 800
  }
  return 900
}

const invoiceActionRank = (path: string): number => {
  if (path.endsWith('/attachments')) {
    return 10
  }
  if (path.includes('/attachments/')) {
    return 20
  }
  if (path.endsWith('/pdf')) {
    return 30
  }
  if (path.endsWith('/issue')) {
    return 40
  }
  if (path.endsWith('/email-preview')) {
    return 50
  }
  if (path.endsWith('/email')) {
    return 60
  }
  if (path.endsWith('/email-status')) {
    return 70
  }
  if (path.endsWith('/reminder-preview')) {
    return 80
  }
  if (path.endsWith('/reminder')) {
    return 90
  }
  if (path.endsWith('/payments')) {
    return 100
  }
  return 0
}

const pathRank = (path: string): number => {
  if (path.startsWith('/api/auth')) {
    return 500
  }
  if (path.startsWith('/api/timesheets')) {
    return 2000 + timesheetsSectionRank(path) * 100
  }
  if (path.startsWith('/api/invoices')) {
    return 3000 + invoiceActionRank(path)
  }
  if (path.startsWith('/api/invoice-timesheets')) {
    return 3100
  }
  if (path.startsWith('/api/service-requests/admin')) {
    return 1100
  }
  if (path.startsWith('/api/service-requests')) {
    return 1000
  }
  if (path.startsWith('/api/')) {
    return 0
  }
  return 3000
}

const pathDepth = (path: string): number => path.split('/').filter(Boolean).length

const comparePaths = ([left]: [string, OpenApiPathItem], [right]: [string, OpenApiPathItem]): number =>
  pathRank(left) - pathRank(right) || pathDepth(left) - pathDepth(right) || left.localeCompare(right)

const orderMethods = (pathItem: OpenApiPathItem): OpenApiPathItem =>
  Object.fromEntries(
    Object.entries(pathItem).sort(([left], [right]) => {
      const leftRank = METHOD_ORDER.indexOf(left)
      const rightRank = METHOD_ORDER.indexOf(right)
      return (leftRank === -1 ? METHOD_ORDER.length : leftRank) - (rightRank === -1 ? METHOD_ORDER.length : rightRank)
    })
  )

export const orderOpenApiDocument = <T extends OpenApiDocument>(document: T): T => {
  if (!document.paths) {
    return document
  }
  return {
    ...document,
    paths: Object.fromEntries(
      Object.entries(document.paths)
        .sort(comparePaths)
        .map(([path, item]) => [path, orderMethods(item)])
    )
  }
}
