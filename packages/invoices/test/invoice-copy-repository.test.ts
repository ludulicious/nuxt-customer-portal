import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'

type Expression =
  { kind: 'and'; values: Expression[] } | { kind: 'eq' | 'ne'; column: { field: string }; value: unknown }
interface Query {
  from: (table: { name: string }) => Query
  where: (expression: Expression) => Query
  orderBy: () => Query
  limit: (value: number) => Query
  for: () => Query
  then: (resolve: (value: unknown) => unknown) => Promise<unknown>
}

test('invoice copy transactions isolate organizations, reset lifecycle state and prevent repeated credits', async (context) => {
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
  let enabled = true
  let failLineInsert = false
  const matches = (row: Record<string, unknown>, expression: Expression): boolean => {
    if (expression.kind === 'and') {
      return expression.values.every((value) => matches(row, value))
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
        for: () => query,
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
  const state = { schema, database }
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
        source = 'export const getClient = () => null; export const listSelectableClients = () => []'
      }
      if (specifier.endsWith('/server/db/schema/invoices')) {
        source = tableNames
          .map((name) => `export const ${name} = globalThis.__invoiceCopyTest.schema.${name}`)
          .join(';')
      }
      if (specifier === 'drizzle-orm') {
        source = `export const eq = (column, value) => ({kind: 'eq', column, value}); export const ne = (column, value) => ({kind: 'ne', column, value}); export const and = (...values) => ({kind: 'and', values}); export const asc = value => value; export const desc = value => value; export const inArray = () => {}; export const sql = () => {}`
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
  const { copyInvoice, changeInvoiceStatus } = await import('../server/utils/invoice-repository')
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
})
