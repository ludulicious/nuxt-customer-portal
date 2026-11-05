import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'

type Expression =
  | { kind: 'and'; values: Expression[] }
  | { kind: 'eq' | 'ne'; column: { field: string }; value: unknown }
  | { kind: 'in'; column: { field: string }; values: unknown[] }
interface Query {
  from: (table: { name: string }) => Query
  where: (expression: Expression) => Query
  orderBy: () => Query
  limit: (value: number) => Query
  for: () => Query
  then: (resolve: (value: unknown) => unknown) => Promise<unknown>
}

test('invoice lifecycle transactions isolate organizations and protect credits and draft deletion', async (context) => {
  const tableNames = [
    'invoice',
    'invoiceLine',
    'invoiceHistory',
    'invoiceSettings',
    'invoicePayment',
    'invoiceAttachment',
    'invoiceClientAccess',
    'invoiceClientViewer',
    'invoiceEmailDelivery',
    'billingContact'
  ]
  const schema = Object.fromEntries(
    tableNames.map((name) => [
      name,
      new Proxy(
        { name },
        {
          get: (target, field) => (field === 'name' ? target.name : { table: target.name, field })
        }
      )
    ])
  )
  let rows: Record<string, Record<string, unknown>[]> = {}
  let writes: { table: string; value: Record<string, unknown> }[] = []
  let locks = 0
  let rowLocks = 0
  let enabled = true
  let failLineInsert = false
  let foreignKeyFailure = false
  let client: Record<string, unknown> | null = null
  const deleted: string[] = []
  const matches = (row: Record<string, unknown>, expression: Expression): boolean => {
    if (expression.kind === 'and') {
      return expression.values.every((value) => matches(row, value))
    }
    if (expression.kind === 'in') {
      return expression.values.includes(row[expression.column.field])
    }
    return expression.kind === 'ne'
      ? row[expression.column.field] !== expression.value
      : row[expression.column.field] === expression.value
  }
  const database = {
    select: () => {
      let table = ''
      let condition: Expression | undefined
      let limit = Infinity
      const query: Query = {
        from: (value: { name: string }) => {
          table = value.name
          return query
        },
        where: (value: Expression) => {
          condition = value
          return query
        },
        orderBy: () => query,
        limit: (value: number) => {
          limit = value
          return query
        },
        for: () => {
          rowLocks += 1
          return query
        },
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve(
            resolve((rows[table] ?? []).filter((row) => !condition || matches(row, condition)).slice(0, limit))
          )
      }
      return query
    },
    insert: (table: { name: string }) => ({
      values: (value: Record<string, unknown>) => {
        if (table.name === 'invoiceSettings') {
          return { onConflictDoNothing: () => ({ returning: async () => [{ enabled }] }) }
        }
        if (failLineInsert && table.name === 'invoiceLine') {
          throw new Error('Line insert failed')
        }
        writes.push({ table: table.name, value })
        return Promise.resolve()
      }
    }),
    update: (table: { name: string }) => ({
      set: (value: Record<string, unknown>) => ({
        where: (condition: Expression) => {
          const selected = (rows[table.name] ?? []).filter((row) => matches(row, condition))
          if (selected.length) {
            writes.push({ table: table.name, value })
          }
          return { returning: async () => selected.map((row) => ({ ...row, ...value })) }
        }
      })
    }),
    delete: (table: { name: string }) => ({
      where: async (condition: Expression) => {
        if (foreignKeyFailure) {
          throw Object.assign(new Error('Foreign key restriction'), { cause: { code: '23503' } })
        }
        deleted.push(...(rows[table.name] ?? []).filter((row) => matches(row, condition)).map((row) => String(row.id)))
      }
    }),
    execute: async () => {
      locks += 1
    },
    transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
      const previous = writes.slice()
      try {
        return await callback(database)
      } catch (error) {
        writes = previous
        throw error
      }
    }
  }
  const state = { schema, database, getClient: (id: string) => (client?.organizationId === id ? client : null) }
  Object.assign(globalThis, { __invoiceCopyTest: state })
  const dataModule = (source: string) => `data:text/javascript,${encodeURIComponent(source)}`
  const hook = registerHooks({
    resolve(specifier, resolverContext, nextResolve) {
      let source: string | undefined
      if (specifier === '@nuxt-customer-portal/core/server/portal') {
        source =
          'export const db = globalThis.__invoiceCopyTest.database; export const getPortalOrganizationsByIds = () => []; export const listPortalOrganizationMembers = () => []'
      }
      if (specifier === '@nuxt-customer-portal/core/schema') {
        source = 'export const organization = {}; export const user = {}'
      }
      if (specifier.endsWith('/server/db/schema/clients')) {
        source = 'export const clientModule = {}'
      }
      if (specifier.endsWith('/server/utils/client-repository')) {
        source =
          'export const getClient = (id) => globalThis.__invoiceCopyTest.getClient(id); export const listSelectableClients = () => []'
      }
      if (specifier.endsWith('/server/db/schema/invoices')) {
        source = tableNames
          .map((name) => `export const ${name} = globalThis.__invoiceCopyTest.schema.${name}`)
          .join(';')
      }
      if (specifier === 'drizzle-orm') {
        source = `export const eq = (column, value) => ({kind: 'eq', column, value}); export const ne = (column, value) => ({kind: 'ne', column, value}); export const and = (...values) => ({kind: 'and', values}); export const asc = value => value; export const desc = value => value; export const inArray = (column, values) => ({kind: 'in', column, values}); export const sql = () => {}`
      }
      return nextResolve(source ? dataModule(source) : specifier, resolverContext)
    }
  })
  context.after(() => {
    hook.deregister()
    Reflect.deleteProperty(globalThis, '__invoiceCopyTest')
  })
  const previousCreateError = Reflect.get(globalThis, 'createError')
  Object.assign(globalThis, {
    createError: (input: { statusCode: number; message: string }) => Object.assign(new Error(input.message), input)
  })
  context.after(() => {
    Object.assign(globalThis, { createError: previousCreateError })
  })
  const {
    copyInvoice,
    changeInvoiceStatus,
    deleteDraftInvoice,
    getDraftInvoiceRecipient,
    refreshDraftInvoiceRecipient,
    updateInvoice
  } = await import('../server/utils/invoice-repository')
  const source = {
    id: 'source',
    organizationId: 'provider',
    clientOrganizationId: 'client',
    number: '2026.0001',
    status: 'PAID',
    documentType: 'invoice',
    issueDate: '2026-01-01',
    dueDate: '2026-01-31',
    currency: 'EUR',
    subject: 'Consulting',
    notes: 'Original note',
    senderName: 'Provider',
    senderAddress: 'Provider address',
    recipientName: 'Client',
    recipientAddress: 'Client address',
    recipientEmail: 'client@example.test',
    recipientLocale: 'en',
    automated: true,
    externalReference: 'stripe:source',
    agreedTotalMinor: 185,
    taxReviewRequired: false,
    createdById: 'old-actor',
    issuedAt: new Date(),
    importMetadata: { source: 'stripe' }
  }
  const line = {
    id: 'old-line',
    invoiceId: 'source',
    position: 0,
    quantityMilli: 1500,
    unitPriceMinor: 101,
    vatRateBasisPoints: 2100,
    exactTaxMinor: 33,
    description: 'Consulting',
    unit: 'hour'
  }
  const reset = () => {
    rows = { invoice: [source], invoiceLine: [line] }
    writes = []
    locks = 0
  }
  reset()
  const duplicate = await copyInvoice('provider', 'actor', 'source', false)
  const duplicated = writes.find((write) => write.table === 'invoice')!.value
  assert.equal(duplicated.id, duplicate.id)
  assert.equal(duplicated.number, '2026.0002')
  assert.equal(duplicated.createdById, 'actor')
  assert.equal(duplicated.recipientEmail, source.recipientEmail)
  assert.equal(duplicated.notes, source.notes)
  assert.equal(duplicated.originalInvoiceId, null)
  for (const field of ['status', 'issuedAt', 'externalReference', 'automated', 'importMetadata']) {
    assert.equal(duplicated[field], undefined)
  }
  assert.deepEqual(
    writes.map((write) => write.table),
    ['invoice', 'invoiceLine', 'invoiceHistory']
  )
  assert.equal(writes[1]!.value.unitPriceMinor, 101)
  assert.notEqual(writes[1]!.value.id, line.id)
  assert.equal(locks, 1)
  reset()
  rows.invoice!.push({ ...source, id: 'another', number: '2026.0002' })
  await copyInvoice('provider', 'actor', 'source', false)
  assert.equal(writes[0]!.value.number, '2026.0003')
  reset()
  await copyInvoice('provider', 'actor', 'source', true)
  const credit = writes[0]!.value
  assert.equal(credit.documentType, 'credit')
  assert.equal(credit.originalInvoiceId, 'source')
  assert.equal(credit.agreedTotalMinor, null)
  assert.equal(writes[1]!.value.exactTaxMinor, -33)
  assert.equal(writes[1]!.value.unitPriceMinor, -101)
  for (const status of ['DRAFT', 'ISSUED', 'PAID']) {
    reset()
    rows.invoice!.push({
      ...source,
      id: 'existing-credit',
      documentType: 'credit',
      originalInvoiceId: 'source',
      status
    })
    await assert.rejects(copyInvoice('provider', 'actor', 'source', true), /already has a credit/)
    assert.deepEqual(writes, [])
  }
  reset()
  rows.invoice!.push({ ...source, id: 'void-credit', originalInvoiceId: 'source', status: 'VOID' })
  await copyInvoice('provider', 'actor', 'source', true)
  reset()
  await assert.rejects(copyInvoice('other-provider', 'actor', 'source', false), /not found/)
  assert.deepEqual(writes, [])
  for (const status of ['DRAFT', 'VOID']) {
    reset()
    rows.invoice = [{ ...source, status }]
    await assert.rejects(copyInvoice('provider', 'actor', 'source', true), /Only issued or paid/)
    assert.deepEqual(writes, [])
  }
  reset()
  rows.invoice = [{ ...source, documentType: 'credit' }]
  for (const credit of [false, true]) {
    await assert.rejects(copyInvoice('provider', 'actor', 'source', credit), /cannot be duplicated or credited/)
  }
  reset()
  rows.invoiceLine = [{ ...line, unitPriceMinor: 0, exactTaxMinor: 0 }]
  await assert.rejects(copyInvoice('provider', 'actor', 'source', true), /positive total/)
  assert.deepEqual(writes, [])
  reset()
  enabled = false
  await assert.rejects(copyInvoice('provider', 'actor', 'source', false), /not enabled/)
  assert.equal(locks, 0)
  enabled = true
  reset()
  failLineInsert = true
  await assert.rejects(copyInvoice('provider', 'actor', 'source', true), /Line insert failed/)
  assert.deepEqual(writes, [])
  failLineInsert = false
  reset()
  rows.invoice = [
    { ...source, id: 'void-credit', documentType: 'credit', originalInvoiceId: 'source', status: 'VOID' },
    { ...source, id: 'active-credit', documentType: 'credit', originalInvoiceId: 'source', status: 'DRAFT' }
  ]
  await assert.rejects(changeInvoiceStatus('provider', 'actor', 'void-credit', 'UNVOID'), /already has a credit/)
  assert.deepEqual(writes, [])
  const draft = { ...source, status: 'DRAFT', issuedAt: null, automated: false, externalReference: null }
  const resetDraft = () => {
    reset()
    deleted.length = 0
    rows.invoice = [draft]
  }
  for (const documentType of ['invoice', 'credit']) {
    resetDraft()
    rows.invoice = [{ ...draft, documentType }]
    assert.deepEqual(await deleteDraftInvoice('provider', 'source'), { id: 'source' })
    assert.deepEqual(deleted, ['source'])
    assert.equal(locks, 1)
  }
  resetDraft()
  await assert.rejects(deleteDraftInvoice('other-provider', 'source'), /not found/)
  assert.deepEqual(deleted, [])
  for (const patch of [
    { status: 'ISSUED' },
    { status: 'PAID' },
    { status: 'VOID' },
    { issuedAt: new Date() },
    { automated: true },
    { externalReference: 'stripe:source' }
  ]) {
    resetDraft()
    rows.invoice = [{ ...draft, ...patch }]
    await assert.rejects(deleteDraftInvoice('provider', 'source'), { statusCode: 409 })
    assert.deepEqual(deleted, [])
  }
  for (const dependency of ['payment', 'pending-email', 'sent-email', 'credit']) {
    resetDraft()
    if (dependency === 'payment') {
      rows.invoicePayment = [{ invoiceId: 'source' }]
    } else if (dependency === 'credit') {
      rows.invoice!.push({ ...draft, id: 'credit', originalInvoiceId: 'source' })
    } else {
      rows.invoiceEmailDelivery = [{ invoiceId: 'source', status: dependency === 'pending-email' ? 'PENDING' : 'SENT' }]
    }
    await assert.rejects(deleteDraftInvoice('provider', 'source'), { statusCode: 409 })
    assert.deepEqual(deleted, [])
  }
  resetDraft()
  rows.invoiceEmailDelivery = [{ invoiceId: 'source', status: 'FAILED' }]
  await deleteDraftInvoice('provider', 'source')
  assert.deepEqual(deleted, ['source'])
  resetDraft()
  foreignKeyFailure = true
  await assert.rejects(deleteDraftInvoice('provider', 'source'), {
    statusCode: 409,
    message: 'Invoices linked to other records cannot be deleted'
  })
  assert.deepEqual(deleted, [])
  foreignKeyFailure = false
  enabled = false
  await assert.rejects(deleteDraftInvoice('provider', 'source'), { statusCode: 403 })
  assert.deepEqual(deleted, [])
  enabled = true
  resetDraft()
  client = {
    organizationId: 'client',
    clientType: 'organization',
    officialName: 'Current Company',
    name: 'Company',
    address: 'Current address',
    preferredLocale: 'nl',
    invoiceEmail: 'billing@example.test',
    archivedAt: null
  }
  rows.billingContact = [
    { id: 'contact', organizationId: 'client', name: 'Current Contact', email: 'contact@example.test' }
  ]
  const preview = await getDraftInvoiceRecipient('provider', 'source')
  assert.equal(preview.recipientName, 'Current Company')
  assert.equal(preview.recipientAddress, 'Current address')
  assert.equal(preview.suggestedContactId, 'contact')
  assert.deepEqual(writes, [])
  client.address = 'Changed since preview'
  rows.billingContact[0]!.name = 'Renamed since preview'
  await refreshDraftInvoiceRecipient('provider', 'actor', 'source', 'contact')
  assert.equal(writes[0]!.value.recipientAddress, 'Changed since preview')
  assert.equal(writes[0]!.value.recipientContactName, 'Renamed since preview')
  assert.equal(writes[0]!.value.recipientEmail, 'contact@example.test')
  assert.equal(writes[0]!.value.recipientLocale, 'nl')
  assert.deepEqual(
    Object.keys(writes[0]!.value).sort(),
    [
      'recipientName',
      'recipientAddress',
      'recipientContactName',
      'recipientEmail',
      'recipientLocale',
      'updatedAt'
    ].sort()
  )
  assert.equal(writes[1]!.value.action, 'EDITED')
  assert.equal(writes[1]!.value.actorUserId, 'actor')
  resetDraft()
  rows.billingContact = [
    { id: 'other-contact', organizationId: 'other-client', name: 'Other', email: 'other@example.test' }
  ]
  await assert.rejects(refreshDraftInvoiceRecipient('provider', 'actor', 'source', 'other-contact'), {
    statusCode: 400
  })
  assert.deepEqual(writes, [])
  for (const status of ['ISSUED', 'PAID', 'VOID']) {
    resetDraft()
    rows.invoice = [{ ...draft, status }]
    await assert.rejects(getDraftInvoiceRecipient('provider', 'source'), { statusCode: 409 })
    await assert.rejects(refreshDraftInvoiceRecipient('provider', 'actor', 'source', null), { statusCode: 409 })
    assert.deepEqual(writes, [])
  }
  resetDraft()
  await assert.rejects(refreshDraftInvoiceRecipient('other-provider', 'actor', 'source', null), { statusCode: 404 })
  assert.deepEqual(writes, [])
  rows.invoice = [{ ...draft, clientOrganizationId: null }]
  await assert.rejects(refreshDraftInvoiceRecipient('provider', 'actor', 'source', null), { statusCode: 409 })
  resetDraft()
  client = { ...client, clientType: 'person', officialName: '', name: 'Private Client' }
  await refreshDraftInvoiceRecipient('provider', 'actor', 'source', null)
  assert.equal(writes[0]!.value.recipientName, 'Private Client')
  assert.equal(writes[0]!.value.recipientEmail, 'billing@example.test')
  assert.equal(writes[0]!.value.recipientContactName, null)
  writes = []
  await assert.rejects(refreshDraftInvoiceRecipient('provider', 'actor', 'source', 'contact'), { statusCode: 400 })
  assert.deepEqual(writes, [])
  client.archivedAt = new Date()
  await assert.rejects(refreshDraftInvoiceRecipient('provider', 'actor', 'source', null), { statusCode: 404 })
  assert.deepEqual(writes, [])

  const edit = {
    number: '2026.0002',
    issueDate: '2026-02-01',
    dueDate: '2026-03-01',
    lines: [{ ...line, description: 'Updated description' }]
  }
  const resetEdit = () => {
    resetDraft()
    rowLocks = 0
    rows.invoice = [{ ...draft, agreedTotalMinor: null, taxReviewRequired: false }]
    rows.invoiceLine = [{ ...line }]
  }
  resetEdit()
  await updateInvoice('provider', 'actor', 'source', edit)
  assert.equal(rowLocks, 1)
  assert.equal(writes[0]!.table, 'invoiceLine')
  assert.equal(writes[0]!.value.id, 'old-line')
  assert.equal(writes[0]!.value.description, 'Updated description')
  assert.equal(writes[0]!.value.exactTaxMinor, 33)
  assert.equal(writes[1]!.table, 'invoice')
  assert.ok(!('lines' in writes[1]!.value))
  assert.equal(writes[2]!.value.action, 'EDITED')
  assert.deepEqual(deleted, [])
  resetEdit()
  await updateInvoice('provider', 'actor', 'source', { ...edit, lines: [{ ...edit.lines[0]!, unitPriceMinor: 200 }] })
  assert.equal(writes[0]!.value.unitPriceMinor, 200)
  assert.equal(writes[0]!.value.exactTaxMinor, null)
  assert.equal(writes[0]!.value.taxDetails, null)
  resetEdit()
  const { id: _lineId, ...addedLine } = edit.lines[0]!
  await updateInvoice('provider', 'actor', 'source', { ...edit, lines: [addedLine] })
  assert.deepEqual(deleted, ['old-line'])
  assert.notEqual(writes[0]!.value.id, 'old-line')
  assert.equal(writes[0]!.value.position, 0)
  resetEdit()
  const secondLine = { ...line, id: 'second-line' }
  rows.invoiceLine!.push(secondLine)
  await updateInvoice('provider', 'actor', 'source', { ...edit, lines: [secondLine, line] })
  assert.deepEqual(
    writes.slice(0, 2).map((write) => [write.value.id, write.value.position]),
    [
      ['second-line', 0],
      ['old-line', 1]
    ]
  )
  assert.deepEqual(deleted, [])
  resetEdit()
  await updateInvoice('provider', 'actor', 'source', { ...edit, lines: undefined })
  assert.equal(writes[0]!.table, 'invoice')
  assert.deepEqual(deleted, [])
  for (const lines of [[{ ...line, id: 'foreign-line' }], [line, line], [{ ...line, unitPriceMinor: -100 }]]) {
    resetEdit()
    await assert.rejects(updateInvoice('provider', 'actor', 'source', { ...edit, lines }), { statusCode: 400 })
    assert.deepEqual(writes, [])
  }
  for (const status of ['ISSUED', 'PAID', 'VOID']) {
    resetEdit()
    rows.invoice![0]!.status = status
    await assert.rejects(updateInvoice('provider', 'actor', 'source', edit), { statusCode: 409 })
    assert.deepEqual(writes, [])
  }
  resetEdit()
  await assert.rejects(updateInvoice('other-provider', 'actor', 'source', edit), { statusCode: 404 })
  assert.deepEqual(writes, [])
  resetEdit()
  rows.invoice![0]!.agreedTotalMinor = 185
  await updateInvoice('provider', 'actor', 'source', edit)
  assert.equal(writes[0]!.value.exactTaxMinor, 33)
  assert.equal(writes[1]!.value.taxReviewRequired, false)
  resetEdit()
  rows.invoice![0]!.agreedTotalMinor = 185
  await updateInvoice('provider', 'actor', 'source', {
    ...edit,
    lines: [{ ...line, quantityMilli: 1000, unitPriceMinor: 185, vatRateBasisPoints: 0 }]
  })
  assert.equal(writes[0]!.value.exactTaxMinor, null)
  assert.equal(writes[1]!.value.taxReviewRequired, true)
  resetEdit()
  rows.invoice![0]!.agreedTotalMinor = 185
  await assert.rejects(
    updateInvoice('provider', 'actor', 'source', { ...edit, lines: [{ ...line, unitPriceMinor: 200 }] }),
    { statusCode: 409 }
  )
  assert.deepEqual(writes, [])
  resetEdit()
  rows.invoice![0]!.documentType = 'credit'
  await updateInvoice('provider', 'actor', 'source', { ...edit, lines: [{ ...line, unitPriceMinor: -101 }] })
  assert.equal(writes[0]!.value.unitPriceMinor, -101)
  resetEdit()
  failLineInsert = true
  await assert.rejects(
    updateInvoice('provider', 'actor', 'source', { ...edit, lines: [line, addedLine] }),
    /Line insert failed/
  )
  assert.deepEqual(writes, [])
  failLineInsert = false
})
