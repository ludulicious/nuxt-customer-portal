import { createHash } from 'node:crypto'
import pg from 'pg'

const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const required = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} is required`)
  }
  return value
}
const sourceId = (value) => {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error('Invalid Harvest ID')
  }
  return String(value)
}
const integer = (value, scale, label) => {
  const number = Number(value)
  const result = Math.round(number * scale)
  if (value == null || !Number.isFinite(number) || !Number.isSafeInteger(result) || Math.abs(result) > 2147483647) {
    throw new Error(`Invalid or out-of-range ${label}`)
  }
  return result
}
const date = (value) => {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    new Date(value).toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`Invalid date: ${value}`)
  }
  return value
}
const week = (value, startsOn) => {
  const day = new Date(`${date(value)}T00:00:00Z`)
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() - startsOn + 7) % 7))
  return day.toISOString().slice(0, 10)
}

// URLs are constructed locally: never forward credentials to a pagination URL.
export async function exportHarvest({
  token,
  accountId,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
}) {
  required(token, 'HARVEST_ACCESS_TOKEN')
  if (!/^\d+$/.test(String(accountId))) {
    throw new Error('HARVEST_ACCOUNT_ID is required')
  }
  const get = async (path) => {
    for (let attempt = 0; attempt < 5; attempt++) {
      let response
      try {
        response = await fetchImpl(`https://api.harvestapp.com/v2/${path}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Harvest-Account-Id': String(accountId),
            'User-Agent': 'nuxt-customer-portal Harvest migration'
          },
          redirect: 'error',
          signal: AbortSignal.timeout(30000)
        })
      } catch {
        throw new Error(`Harvest request failed: ${path.split('?')[0]}`)
      }
      if (response.ok) {
        return response.json()
      }
      if (response.status !== 429 && response.status < 500) {
        throw new Error(`Harvest returned ${response.status} for ${path.split('?')[0]}`)
      }
      if (attempt === 4) {
        throw new Error('Harvest retry limit reached; export again later')
      }
      const retry = Number(response.headers.get('retry-after'))
      await sleep(Math.min(60000, Math.max(1000 * 2 ** attempt, Number.isFinite(retry) ? retry * 1000 : 0)))
    }
  }
  const list = async (path, key) => {
    const result = []
    const seen = new Set()
    let next = `${path}?per_page=2000&page=1`
    while (next) {
      if (seen.has(next)) {
        throw new Error('Invalid Harvest pagination')
      }
      seen.add(next)
      const body = await get(next)
      if (!Array.isArray(body[key])) {
        throw new Error(`Invalid Harvest response for ${path}`)
      }
      result.push(...body[key])
      if (body.links && Object.hasOwn(body.links, 'next')) {
        if (body.links.next === null) {
          next = null
        } else {
          const url = new URL(body.links.next)
          if (
            url.origin !== 'https://api.harvestapp.com' ||
            url.pathname !== `/v2/${path}` ||
            url.username ||
            url.password ||
            url.hash
          ) {
            throw new Error('Invalid Harvest pagination URL')
          }
          next = `${path}${url.search}`
        }
      } else if (body.next_page === null) {
        next = null
      } else if (Number.isSafeInteger(body.next_page) && body.next_page > 0) {
        next = `${path}?per_page=2000&page=${body.next_page}`
      } else {
        throw new Error(`Missing Harvest pagination for ${path}`)
      }
    }
    return result
  }
  const me = await get('users/me')
  if (!me.is_admin && me.access_roles?.includes('administrator') !== true) {
    throw new Error('Use a Harvest administrator token to export the complete account')
  }
  const snapshot = {
    format: 'nuxt-customer-portal/harvest-v1',
    accountId: String(accountId),
    exportedAt: new Date().toISOString()
  }
  for (const key of ['clients', 'contacts', 'users', 'tasks', 'projects', 'time_entries', 'invoices']) {
    snapshot[key] = await list(key, key)
  }
  snapshot.task_assignments = []
  for (const project of snapshot.projects) {
    for (const assignment of await list(`projects/${sourceId(project.id)}/task_assignments`, 'task_assignments')) {
      snapshot.task_assignments.push({ ...assignment, project_id: project.id })
    }
  }
  snapshot.payments = []
  for (const invoice of snapshot.invoices) {
    for (const payment of await list(`invoices/${sourceId(invoice.id)}/payments`, 'invoice_payments')) {
      snapshot.payments.push({ ...payment, invoice_id: invoice.id })
    }
  }
  return snapshot
}

export function planHarvest(
  snapshot,
  { provider, actorId, users = {}, clients = {}, createHistoricalUsers = false, weekStartsOn = 1, sender = {} }
) {
  if (snapshot.format !== 'nuxt-customer-portal/harvest-v1' || !/^\d+$/.test(snapshot.accountId)) {
    throw new Error('Invalid Harvest snapshot')
  }
  if (!Number.isInteger(weekStartsOn) || weekStartsOn < 0 || weekStartsOn > 6) {
    throw new Error('Invalid week start')
  }
  required(provider, 'Provider ID')
  required(actorId, 'Actor user ID')
  const id = (kind, source) => `harvest_${hash([provider, snapshot.accountId, kind, String(source)]).slice(0, 40)}`
  const rows = []
  const warnings = []
  const errors = []
  const collections = {}
  for (const key of [
    'clients',
    'contacts',
    'users',
    'tasks',
    'projects',
    'time_entries',
    'invoices',
    'task_assignments',
    'payments'
  ]) {
    if (!Array.isArray(snapshot[key])) {
      throw new Error(`Missing Harvest collection: ${key}`)
    }
    collections[key] = new Map()
    for (const item of snapshot[key]) {
      const keyId = sourceId(item.id)
      if (collections[key].has(keyId)) {
        throw new Error(`Duplicate Harvest ${key} ID ${keyId}`)
      }
      collections[key].set(keyId, item)
    }
  }
  const find = (collection, value) => {
    const item = collections[collection].get(sourceId(value))
    if (!item) {
      throw new Error(`Missing ${collection} ${value}`)
    }
    return item
  }
  const clientId = (value) => {
    find('clients', value)
    return clients[value] || id('client', value)
  }
  const add = (table, data) => rows.push({ table, data })
  const attempt = (label, fn) => {
    try {
      fn()
    } catch (error) {
      errors.push(`${label}: ${error.message}`)
    }
  }
  const resolvedUsers = { ...users }
  const transformations = {
    historicalUsers: [],
    renamedProjects: [],
    mergedContacts: [],
    externallyBilledEntries: 0,
    creditInvoices: 0,
    closedInvoices: 0
  }
  for (const person of snapshot.users) {
    if (resolvedUsers[person.id] || !createHistoricalUsers) {
      continue
    }
    attempt(`User ${person.id}`, () => {
      const userId = id('user', person.id)
      const name = [person.first_name, person.last_name].filter(Boolean).join(' ') || person.name || person.email
      const email = required(person.email, 'Historical user email').trim().toLowerCase()
      add('public.user', {
        id: userId,
        name: required(name, 'Historical user name'),
        first_name: person.first_name || null,
        last_name: person.last_name || null,
        email,
        email_verified: false,
        role: 'user',
        banned: true,
        ban_reason: 'Historical Harvest identity; login disabled',
        created_at: person.created_at || snapshot.exportedAt,
        updated_at: person.updated_at || snapshot.exportedAt
      })
      add('public.member', {
        id: id('member', person.id),
        organization_id: provider,
        user_id: userId,
        role: 'member',
        created_at: person.created_at || snapshot.exportedAt
      })
      add('timesheets.team_member_settings', {
        id: id('team-settings', person.id),
        organization_id: provider,
        user_id: userId,
        can_enter_time: false,
        internal_approval_required: false
      })
      resolvedUsers[person.id] = userId
      transformations.historicalUsers.push({
        sourceId: person.id,
        targetId: userId,
        name,
        email,
        sourceActive: person.is_active !== false,
        loginEnabled: false
      })
    })
  }
  const paymentActor = (payment) => {
    const person = snapshot.users.find(
      (person) => person.email?.toLowerCase() === payment.recorded_by_email?.toLowerCase()
    )
    return (person && resolvedUsers[person.id]) || actorId
  }
  for (const client of snapshot.clients) {
    attempt(`Client ${client.id}`, () => {
      const target = clientId(client.id)
      if (!clients[client.id]) {
        add('public.organization', {
          id: target,
          name: required(client.name, 'Client name'),
          slug: target,
          organization_type: 'CLIENT',
          created_at: client.created_at || snapshot.exportedAt
        })
        add('clients.client_profile', {
          organization_id: target,
          official_name: client.name,
          address: client.address || '',
          vat_number: client.vat_number || null,
          preferred_locale: sender.preferred_locale || 'en',
          archived_at: client.is_active === false ? snapshot.exportedAt : null
        })
      }
      add('timesheets.workspace_client', {
        id: id('workspace-client', client.id),
        workspace_organization_id: provider,
        client_organization_id: target,
        access_mode: 'DISABLED'
      })
      add('clients.client_module', {
        id: id('client-module', client.id),
        organization_id: target,
        module_id: 'timesheets',
        enabled: true
      })
    })
  }
  const contactGroups = new Map()
  for (const contact of [...snapshot.contacts].sort((a, b) => a.id - b.id)) {
    attempt(`Contact ${contact.id}`, () => {
      const organizationId = clientId(contact.client.id)
      const email = required(contact.email, 'Contact email').trim().toLowerCase()
      const key = `${organizationId}:${email}`
      const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || email
      const previous = contactGroups.get(key)
      if (previous) {
        if (!previous.names.includes(name)) {
          previous.names.push(name)
        }
        previous.data.name = previous.names.join(' / ')
        previous.sources.push(contact.id)
      } else {
        const data = {
          id: id('contact', contact.id),
          organization_id: organizationId,
          name,
          email,
          phone: contact.phone_office || contact.phone_mobile || null
        }
        add('invoices.billing_contact', data)
        contactGroups.set(key, { data, names: [name], sources: [contact.id] })
      }
    })
  }
  for (const group of contactGroups.values()) {
    if (group.sources.length > 1) {
      transformations.mergedContacts.push({
        sourceIds: group.sources,
        targetId: group.data.id,
        email: group.data.email,
        names: group.names
      })
    }
  }
  for (const task of snapshot.tasks) {
    attempt(`Task ${task.id}`, () => {
      add('timesheets.activity_type', {
        id: id('task', task.id),
        organization_id: provider,
        name: required(task.name, 'Task name'),
        billable: Boolean(task.billable_by_default),
        active: task.is_active !== false
      })
    })
  }
  const projectNameCounts = new Map()
  for (const project of snapshot.projects) {
    projectNameCounts.set(project.name, (projectNameCounts.get(project.name) || 0) + 1)
  }
  const reservedNames = new Set(
    snapshot.projects.filter((project) => projectNameCounts.get(project.name) === 1).map((project) => project.name)
  )
  const projectNames = new Map()
  for (const project of [...snapshot.projects].sort((a, b) => a.id - b.id)) {
    if (projectNameCounts.get(project.name) === 1) {
      projectNames.set(project.id, project.name)
      continue
    }
    let name = `${project.name} [Harvest ${project.id}]`
    let suffix = 1
    while (reservedNames.has(name)) {
      name = `${project.name} [Harvest ${project.id}:${suffix++}]`
    }
    reservedNames.add(name)
    projectNames.set(project.id, name)
    transformations.renamedProjects.push({ sourceId: project.id, originalName: project.name, importedName: name })
  }
  for (const project of snapshot.projects) {
    attempt(`Project ${project.id}`, () => {
      add('timesheets.project', {
        id: id('project', project.id),
        organization_id: provider,
        client_organization_id: clientId(project.client.id),
        name: required(projectNames.get(project.id), 'Project name'),
        code: project.code || null,
        status: project.is_active === false ? 'ARCHIVED' : 'ACTIVE',
        starts_on: project.starts_on ? date(project.starts_on) : null,
        ends_on: project.ends_on ? date(project.ends_on) : null,
        budget_minutes:
          project.budget_by === 'project' && project.budget != null
            ? integer(project.budget, 60, 'budget hours')
            : null,
        budget_minor: project.fee != null ? integer(project.fee, 100, 'project fee') : null
      })
    })
  }
  const links = new Set()
  const link = (project, task) => {
    find('projects', project)
    find('tasks', task)
    const key = `${project}:${task}`
    if (!links.has(key)) {
      add('timesheets.project_activity', {
        id: id('project-task', key),
        project_id: id('project', project),
        activity_type_id: id('task', task)
      })
    }
    links.add(key)
  }
  for (const assignment of snapshot.task_assignments) {
    attempt(`Task assignment ${assignment.id}`, () => link(assignment.project_id, assignment.task.id))
  }
  const weeks = new Set()
  for (const entry of snapshot.time_entries) {
    attempt(`Time entry ${entry.id}`, () => {
      find('users', entry.user.id)
      const user = resolvedUsers[entry.user.id]
      if (!user) {
        throw new Error(`Map Harvest user ${entry.user.id} to a provider member email in --mapping`)
      }
      const project = find('projects', entry.project.id)
      if (project.client.id !== entry.client.id) {
        throw new Error('Client does not match project')
      }
      if (entry.is_running || entry.timer_started_at) {
        throw new Error('Stop the running Harvest timer before exporting')
      }
      if (entry.is_billed) {
        transformations.externallyBilledEntries++
      }
      if (entry.invoice) {
        find('invoices', entry.invoice.id)
      }
      link(entry.project.id, entry.task.id)
      const starts = week(entry.spent_date, weekStartsOn)
      const weekKey = `${user}:${starts}`
      if (!weeks.has(weekKey)) {
        add('timesheets.weekly_timesheet', {
          id: id('week', weekKey),
          organization_id: provider,
          user_id: user,
          week_starts_on: starts,
          status: 'DRAFT'
        })
      }
      weeks.add(weekKey)
      const status =
        { unsubmitted: 'DRAFT', submitted: 'SUBMITTED', approved: 'APPROVED' }[entry.approval_status] ||
        (entry.is_closed ? 'APPROVED' : 'DRAFT')
      const submission = status === 'DRAFT' ? null : id('submission', entry.id)
      if (submission) {
        add('timesheets.submission', {
          id: submission,
          weekly_timesheet_id: id('week', weekKey),
          organization_id: provider,
          user_id: user,
          period_starts_on: entry.spent_date,
          period_ends_on: entry.spent_date,
          status
        })
      }
      const minutes = integer(entry.hours, 60, 'time hours')
      if (minutes < 0) {
        throw new Error('Negative time is unsupported')
      }
      if (Math.abs(minutes - Number(entry.hours) * 60) > 0.000001) {
        warnings.push(`Time entry ${entry.id}: ${entry.hours} hours rounded to ${minutes} minutes`)
      }
      add('timesheets.time_entry', {
        id: id('entry', entry.id),
        organization_id: provider,
        weekly_timesheet_id: id('week', weekKey),
        submission_id: submission,
        user_id: user,
        project_id: id('project', entry.project.id),
        client_organization_id: clientId(entry.client.id),
        activity_type_id: id('task', entry.task.id),
        entry_date: date(entry.spent_date),
        duration_minutes: minutes,
        note: entry.notes || null,
        externally_billed: Boolean(entry.is_billed),
        import_metadata: { source: 'harvest', accountId: snapshot.accountId, entry },
        billable_snapshot: Boolean(entry.billable),
        hourly_rate_minor_snapshot: integer(entry.billable_rate ?? 0, 100, 'hourly rate'),
        currency_snapshot: find('clients', entry.client.id).currency || sender.currency || 'EUR'
      })
    })
  }
  for (const invoice of snapshot.invoices) {
    attempt(`Invoice ${invoice.id}`, () => {
      const status = { draft: 'DRAFT', open: 'ISSUED', paid: 'PAID', closed: 'VOID' }[invoice.state]
      if (!status) {
        throw new Error(
          `Unsupported invoice state ${invoice.state}; closed/write-off invoices need manual reconciliation`
        )
      }
      if (!/^[A-Z]{3}$/.test(invoice.currency)) {
        throw new Error('Invalid invoice currency')
      }
      if (
        new Intl.NumberFormat('en', { style: 'currency', currency: invoice.currency }).resolvedOptions()
          .maximumFractionDigits !== 2
      ) {
        throw new Error('Only currencies with two decimal minor units are supported')
      }
      const isCredit = Number(invoice.amount) < 0
      if (isCredit) {
        transformations.creditInvoices++
      }
      if (invoice.state === 'closed') {
        transformations.closedInvoices++
      }
      if (invoice.retainer) {
        throw new Error('Retainer invoices require manual reconciliation')
      }
      const client = find('clients', invoice.client.id)
      const invoiceId = id('invoice', invoice.id)
      const creatorId = resolvedUsers[invoice.creator?.id] || actorId
      add('invoices.invoice', {
        id: invoiceId,
        organization_id: provider,
        client_organization_id: clientId(client.id),
        number: required(invoice.number, 'Invoice number'),
        document_type: isCredit ? 'credit' : 'invoice',
        import_metadata: {
          source: 'harvest',
          accountId: snapshot.accountId,
          invoice,
          payments: snapshot.payments.filter((payment) => payment.invoice_id === invoice.id)
        },
        created_at: invoice.created_at || `${invoice.issue_date}T00:00:00Z`,
        updated_at: invoice.updated_at || invoice.created_at || `${invoice.issue_date}T00:00:00Z`,
        external_reference: `harvest:${snapshot.accountId}:${invoice.id}`,
        status,
        currency: invoice.currency,
        issue_date: date(invoice.issue_date),
        due_date: date(invoice.due_date || invoice.issue_date),
        subject: invoice.subject || null,
        notes: invoice.notes || null,
        sender_name: required(sender.name, 'Provider name'),
        sender_address: sender.address || '',
        sender_registration: sender.registration_number || null,
        sender_vat_number: sender.vat_number || null,
        sender_iban: sender.iban || null,
        sender_bic: sender.bic || null,
        recipient_name: client.name,
        recipient_address: client.address || '',
        recipient_locale: sender.preferred_locale || 'en',
        created_by_id: creatorId,
        issued_at: status === 'DRAFT' ? null : invoice.sent_at || `${invoice.issue_date}T00:00:00Z`
      })
      if (!Array.isArray(invoice.line_items) || !invoice.line_items.length) {
        throw new Error('Invoice has no lines')
      }
      const lines = invoice.line_items.map((line, position) => {
        const quantity = integer(line.quantity, 1000, 'invoice quantity')
        const price = integer(line.unit_price, 100, 'invoice unit price')
        const amount = integer(line.amount, 100, 'invoice line amount')
        if (Math.round((quantity * price) / 1000) !== amount) {
          throw new Error(`Line ${line.id} exceeds portal precision; reconcile manually`)
        }
        return {
          source: line,
          data: {
            id: id('line', `${invoice.id}:${line.id}`),
            invoice_id: invoiceId,
            position,
            description: line.description || line.kind || 'Harvest invoice line',
            quantity_milli: quantity,
            unit: line.kind === 'Hours' ? 'hour' : 'item',
            unit_price_minor: price,
            vat_rate_basis_points: integer(
              (line.taxed ? Number(invoice.tax || 0) : 0) + (line.taxed2 ? Number(invoice.tax2 || 0) : 0),
              100,
              'tax rate'
            ),
            exact_tax_minor: 0,
            tax_details: { harvest: line, tax: invoice.tax, tax2: invoice.tax2, discount: invoice.discount }
          }
        }
      })
      for (const [flag, total] of [
        ['taxed', invoice.tax_amount],
        ['taxed2', invoice.tax2_amount]
      ]) {
        const tax = integer(total ?? 0, 100, 'tax amount')
        const taxable = lines.filter((line) => line.source[flag])
        const basis = taxable.reduce((sum, line) => sum + Number(line.source.amount), 0)
        if (tax && !basis) {
          throw new Error('Tax has no taxable lines')
        }
        let allocated = 0
        taxable.forEach((line, index) => {
          const share =
            index === taxable.length - 1 ? tax - allocated : Math.round((tax * Number(line.source.amount)) / basis)
          line.data.exact_tax_minor += share
          allocated += share
        })
      }
      const discount = integer(invoice.discount_amount ?? 0, 100, 'discount')
      const total = lines.reduce(
        (sum, line) => sum + integer(line.source.amount, 100, 'line amount') + line.data.exact_tax_minor,
        -discount
      )
      if (total !== integer(invoice.amount, 100, 'invoice total')) {
        throw new Error('Invoice total does not reconcile')
      }
      for (const line of lines) {
        add('invoices.invoice_line', line.data)
      }
      if (discount) {
        add('invoices.invoice_line', {
          id: id('discount', invoice.id),
          invoice_id: invoiceId,
          position: lines.length,
          description: 'Harvest invoice discount',
          quantity_milli: 1000,
          unit_price_minor: -discount,
          vat_rate_basis_points: 0,
          exact_tax_minor: 0
        })
      }
      const payments = snapshot.payments.filter((payment) => payment.invoice_id === invoice.id)
      const paid = payments.reduce((sum, payment) => sum + integer(payment.amount, 100, 'payment'), 0)
      if (paid !== total - integer(invoice.due_amount, 100, 'balance')) {
        throw new Error('Payments do not reconcile with invoice balance')
      }
      for (const payment of payments) {
        add('invoices.invoice_payment', {
          id: id('payment', `${invoice.id}:${payment.id}`),
          invoice_id: invoiceId,
          paid_on: date(payment.paid_date || payment.paid_at?.slice(0, 10)),
          amount_minor: integer(payment.amount, 100, 'payment'),
          reference: payment.transaction_id || null,
          note: payment.notes || null,
          created_by_id: paymentActor(payment),
          created_at: payment.created_at || payment.paid_at || `${payment.paid_date}T00:00:00Z`
        })
      }
      for (const entry of snapshot.time_entries.filter((entry) => entry.invoice?.id === invoice.id)) {
        if (entry.client.id !== client.id) {
          throw new Error(`Time entry ${entry.id} has a different client`)
        }
        const matching = lines.filter((line) => line.source.project?.id === entry.project.id)
        // Harvest exposes invoice-level links, not an exact line match. Use a
        // project line when unambiguous, otherwise the first line as an anchor.
        const anchor = matching.length === 1 ? matching[0] : lines[0]
        if (matching.length !== 1) {
          warnings.push(`Time entry ${entry.id}: invoice ${invoice.number} line association is approximate`)
        }
        add('invoice_timesheets.invoice_time_entry', {
          id: id('invoice-entry', entry.id),
          invoice_id: invoiceId,
          invoice_line_id: anchor.data.id,
          time_entry_id: id('entry', entry.id)
        })
      }
      const history = (kind, timestamp, actor, amount = null, source = invoice.id) => {
        if (!timestamp) {
          return
        }
        add('invoices.invoice_history', {
          id: id(`history-${kind}`, source),
          invoice_id: invoiceId,
          action: kind,
          actor_user_id: actor,
          amount_minor: amount,
          created_at: timestamp
        })
      }
      history('CREATED', invoice.created_at, creatorId)
      history('ISSUED', invoice.sent_at, creatorId)
      for (const payment of payments) {
        history(
          'PAYMENT_REGISTERED',
          payment.paid_at || `${payment.paid_date}T00:00:00Z`,
          paymentActor(payment),
          integer(payment.amount, 100, 'payment'),
          `${invoice.id}:${payment.id}`
        )
      }
      history('VOIDED', invoice.closed_at, creatorId, integer(invoice.due_amount, 100, 'written-off balance'))
      add('invoices.invoice_history', {
        id: id('invoice-history', invoice.id),
        invoice_id: invoiceId,
        action: 'HARVEST_IMPORTED',
        actor_user_id: actorId
      })
    })
  }
  const counts = {}
  for (const row of rows) {
    counts[row.table] = (counts[row.table] || 0) + 1
  }
  return {
    rows,
    errors,
    warnings,
    counts,
    transformations,
    fingerprint: hash({ snapshot, provider, actorId, users, clients, createHistoricalUsers, weekStartsOn, sender })
  }
}

const identifier = (name) => {
  if (!/^[a-z_]+(?:\.[a-z_]+)?$/.test(name)) {
    throw new Error('Invalid SQL identifier')
  }
  return name
    .split('.')
    .map((part) => `"${part}"`)
    .join('.')
}

export async function importHarvest(snapshot, options) {
  if (options.apply && !options.backupConfirmed) {
    throw new Error('Apply requires --backup-confirmed after backing up the database')
  }
  const pool = new pg.Pool({
    connectionString: required(options.databaseUrl || process.env.DATABASE_URL, 'DATABASE_URL'),
    max: 1
  })
  let db
  try {
    db = await pool.connect()
    await db.query(
      options.apply ? 'BEGIN ISOLATION LEVEL SERIALIZABLE' : 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'
    )
    if (options.apply) {
      await db.query("SELECT pg_advisory_xact_lock(hashtext('nuxt-customer-portal:harvest-import'))")
    }
    const providerResult = await db.query(
      "SELECT o.id, o.name, s.* FROM public.organization o JOIN timesheets.workspace_settings w ON w.organization_id=o.id JOIN invoices.settings s ON s.organization_id=o.id WHERE (o.id=$1 OR o.slug=$1) AND o.organization_type='PROVIDER' AND w.workspace_enabled AND s.enabled",
      [required(options.provider, '--provider')]
    )
    if (providerResult.rowCount !== 1) {
      throw new Error('Select one provider with Timesheets and Invoices enabled')
    }
    const provider = providerResult.rows[0]
    const members = (
      await db.query(
        'SELECT u.id, u.email, m.role FROM public.member m JOIN public."user" u ON u.id=m.user_id WHERE m.organization_id=$1',
        [provider.id]
      )
    ).rows
    const actor = members.filter(
      (member) =>
        member.email.toLowerCase() === required(options.actorEmail, '--actor').toLowerCase() &&
        ['owner', 'admin'].includes(member.role)
    )
    if (actor.length !== 1) {
      throw new Error('--actor must be an existing provider owner or admin email')
    }
    const users = {}
    for (const [source, email] of Object.entries(options.mapping?.users || {})) {
      const matches = members.filter((member) => member.email.toLowerCase() === String(email).toLowerCase())
      if (matches.length !== 1) {
        throw new Error(`Harvest user ${source} must map to one existing provider member`)
      }
      users[source] = matches[0].id
    }
    const clients = options.mapping?.clients || {}
    for (const target of Object.values(clients)) {
      const found = await db.query(
        "SELECT o.id FROM public.organization o JOIN clients.client_profile c ON c.organization_id=o.id WHERE o.id=$1 AND o.organization_type='CLIENT'",
        [target]
      )
      if (found.rowCount !== 1) {
        throw new Error(`Client mapping target ${target} is not a portal client`)
      }
    }
    const settings = (
      await db.query('SELECT week_starts_on FROM timesheets.workspace_settings WHERE organization_id=$1', [provider.id])
    ).rows[0]
    const plan = planHarvest(snapshot, {
      provider: provider.id,
      actorId: actor[0].id,
      users,
      createHistoricalUsers: options.mapping?.createHistoricalUsers === true,
      clients,
      weekStartsOn: settings.week_starts_on,
      sender: provider
    })
    const journal = 'nuxt_customer_portal_migrations.harvest_import'
    const exists = (await db.query('SELECT to_regclass($1) AS name', [journal])).rows[0].name
    const previous = exists
      ? (
          await db.query(`SELECT fingerprint FROM ${journal} WHERE provider_id=$1 AND account_id=$2`, [
            provider.id,
            snapshot.accountId
          ])
        ).rows[0]
      : null
    if (previous) {
      if (previous.fingerprint !== plan.fingerprint) {
        throw new Error(
          'This Harvest account was already imported with different data or mappings; incremental synchronization is unsupported'
        )
      }
      await db.query('ROLLBACK')
      return { dryRun: !options.apply, alreadyImported: true, counts: plan.counts, warnings: plan.warnings, errors: [] }
    }
    const columns = (
      await db.query(
        "SELECT table_schema,table_name,column_name FROM information_schema.columns WHERE (table_schema='timesheets' AND table_name='time_entry' AND column_name IN ('externally_billed','import_metadata')) OR (table_schema='invoices' AND table_name='invoice' AND column_name='import_metadata')"
      )
    ).rows
    const requiredMigrations =
      columns.length === 3 ? [] : ['timesheets/0008_imported_history.sql', 'invoices/0003_imported_history.sql']
    if (requiredMigrations.length && options.apply) {
      throw new Error(`Apply package migrations before import: ${requiredMigrations.join(', ')}`)
    }
    // Check all primary and natural keys without changing the database.
    const naturalKeys = {
      'public.organization': ['slug'],
      'public.user': ['email'],
      'public.member': ['organization_id', 'user_id'],
      'timesheets.project': ['organization_id', 'name'],
      'timesheets.activity_type': ['organization_id', 'name'],
      'timesheets.weekly_timesheet': ['organization_id', 'user_id', 'week_starts_on'],
      'invoices.invoice': ['organization_id', 'number'],
      'timesheets.workspace_client': ['workspace_organization_id', 'client_organization_id'],
      'clients.client_module': ['organization_id', 'module_id'],
      'invoices.billing_contact': ['organization_id', 'email']
    }
    const pending = []
    const seen = new Set()
    for (const row of plan.rows) {
      const primary = row.data.id ? 'id' : 'organization_id'
      const keys = naturalKeys[row.table]
      const columns = keys || [primary]
      const key = JSON.stringify([row.table, columns.map((column) => row.data[column])])
      if (seen.has(key)) {
        plan.errors.push(
          `Duplicate target key in ${row.table}: ${columns.map((column) => row.data[column]).join(', ')}`
        )
        continue
      }
      seen.add(key)
      const found = await db.query(
        `SELECT * FROM ${identifier(row.table)} WHERE ${columns.map((column, index) => `${identifier(column)}=$${index + 1}`).join(' AND ')} OR ${identifier(primary)}=$${columns.length + 1}`,
        [...columns.map((column) => row.data[column]), row.data[primary]]
      )
      if (found.rowCount) {
        // Explicit client mappings may already have these shared links. Do not
        // modify existing access or module settings.
        if (
          ['timesheets.workspace_client', 'clients.client_module'].includes(row.table) &&
          found.rowCount === 1 &&
          columns.every((column) => found.rows[0][column] === row.data[column])
        ) {
          continue
        }
        plan.errors.push(
          `Existing record conflicts in ${row.table}: ${columns.map((column) => row.data[column]).join(', ')}`
        )
      }
      pending.push(row)
    }
    const summary = {
      dryRun: !options.apply,
      requiredMigrations,
      alreadyImported: false,
      fingerprint: plan.fingerprint,
      counts: plan.counts,
      transformations: plan.transformations,
      warnings: plan.warnings,
      errors: plan.errors
    }
    if (!options.apply || plan.errors.length) {
      await db.query('ROLLBACK')
      if (options.apply) {
        throw new Error(`Import blocked: ${plan.errors.join('; ')}`)
      }
      return summary
    }
    for (const { table, data } of pending) {
      const columns = Object.keys(data)
      await db.query(
        `INSERT INTO ${identifier(table)} (${columns.map(identifier).join(',')}) VALUES (${columns.map((_, index) => `$${index + 1}`).join(',')})`,
        Object.values(data)
      )
    }
    await db.query('CREATE SCHEMA IF NOT EXISTS nuxt_customer_portal_migrations')
    await db.query(
      `CREATE TABLE IF NOT EXISTS ${journal} (provider_id text NOT NULL REFERENCES public.organization(id), account_id text NOT NULL, fingerprint text NOT NULL, snapshot jsonb NOT NULL, mapping jsonb NOT NULL, imported_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(provider_id, account_id))`
    )
    await db.query(
      `INSERT INTO ${journal} (provider_id, account_id, fingerprint, snapshot, mapping) VALUES ($1,$2,$3,$4,$5)`,
      [provider.id, snapshot.accountId, plan.fingerprint, snapshot, options.mapping || {}]
    )
    await db.query('COMMIT')
    return summary
  } catch (error) {
    if (db) {
      await db.query('ROLLBACK').catch(() => {})
    }
    throw error
  } finally {
    db?.release()
    await pool.end()
  }
}
