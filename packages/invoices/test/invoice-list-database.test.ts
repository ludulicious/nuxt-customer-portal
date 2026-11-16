import assert from 'node:assert/strict'
import test from 'node:test'
import { Client } from 'pg'
import { PgDialect } from 'drizzle-orm/pg-core'
import { invoiceListQueries } from '../server/utils/invoice-list-query'
import { invoiceListQuerySchema } from '../server/utils/invoice-validation'

const databaseUrl = process.env.INVOICE_LIST_TEST_DATABASE_URL

test(
  'invoice summary SQL scopes, calculates, filters, sorts and paginates without document data',
  { skip: !databaseUrl },
  async () => {
    assert.match(new URL(databaseUrl!).pathname, /^\/portal_[a-z0-9_]+_test$/)
    const client = new Client({ connectionString: databaseUrl })
    await client.connect()
    try {
      await client.query('begin')
      await client.query(`create schema invoices;
      create table invoices.invoice (id text primary key, organization_id text, client_organization_id text,
        number text, status text, currency text, issue_date date, due_date date, subject text, recipient_name text,
        sender_logo text, notes text);
      create table invoices.invoice_line (invoice_id text, quantity_milli integer, unit_price_minor integer,
        exact_tax_minor integer, vat_rate_basis_points integer);
      create table invoices.invoice_payment (invoice_id text, amount_minor integer);
      create table invoices.invoice_email_delivery (invoice_id text, purpose text, status text, sent_at timestamp);`)
      await client.query(`insert into invoices.invoice values
      ('a','owner','client-a','INV.2','ISSUED','EUR','2026-11-01','2026-11-10','100%_ done','Alpha','large-image','detail'),
      ('b','owner','client-b','INV.10','PAID','EUR','2026-11-02','2026-11-12',null,'Beta','large-image','detail'),
      ('c','owner','client-a','INV.3','DRAFT','EUR','2026-11-01','2026-11-10',null,'Alpha','large-image','detail'),
      ('credit','owner','client-a','INV.4','ISSUED','EUR','2026-11-01','2026-11-10',null,'Alpha','large-image','detail'),
      ('foreign','other','client-a','INV.1','ISSUED','EUR','2026-11-01','2026-11-01',null,'Other','large-image','detail');
      insert into invoices.invoice_line values ('a',1500,101,null,2100),('a',1000,100,7,2100),
        ('b',1000,1000,null,2100),('credit',1500,-101,null,2100),('foreign',1000,99999,null,2100);
      insert into invoices.invoice_payment values ('a',50),('b',1210);
      insert into invoices.invoice_email_delivery values ('a','REMINDER','SENT','2026-11-11'),
        ('a','REMINDER','FAILED','2026-11-12'),('a','INVOICE','SENT','2026-11-13');`)
      const dialect = new PgDialect()
      const read = async (input: Record<string, unknown> = {}) => {
        const query = invoiceListQuerySchema.parse(input)
        const queries = invoiceListQueries('owner', query, '2026-11-16')
        const count = dialect.sqlToQuery(queries.count)
        const total = (await client.query(count.sql, count.params)).rows[0].total
        const page = Math.min(query.page, Math.max(1, Math.ceil(total / query.pageSize)))
        const list = dialect.sqlToQuery(queries.page(page))
        const rows = (await client.query(list.sql, list.params)).rows
        return { total, page, rows, sql: list.sql, params: list.params }
      }
      const all = await read({ sortBy: 'number', sortDir: 'asc', pageSize: 2 })
      assert.equal(all.total, 4)
      assert.deepEqual(
        all.rows.map((row) => row.id),
        ['a', 'c']
      )
      const a = all.rows[0]
      assert.equal(a.totalMinor, 291) // 152 + round(31.92) + 100 + exact tax 7
      assert.equal(a.outstandingMinor, 241)
      assert.equal(a.daysOverdue, 6)
      assert.equal(a.isOverdue, true)
      assert.equal(a.reminderCount, 1)
      assert.ok(a.lastReminderSentAt)
      assert.equal('senderLogo' in a, false)
      assert.equal('notes' in a, false)
      assert.equal('lines' in a, false)
      const end = await read({ sortBy: 'number', sortDir: 'asc', pageSize: 2, page: 99 })
      assert.equal(end.page, 2)
      assert.deepEqual(
        end.rows.map((row) => row.id),
        ['credit', 'b']
      )
      assert.deepEqual(
        (await read({ overdue: 'true' })).rows.map((row) => row.id),
        ['a']
      )
      assert.equal((await read({ overdue: 'false' })).total, 3)
      assert.equal((await read({ status: 'PAID' })).rows[0].outstandingMinor, 0)
      assert.equal((await read({ clientOrganizationId: 'client-a' })).total, 3)
      assert.deepEqual(
        (await read({ search: '100%_' })).rows.map((row) => row.id),
        ['a']
      )
      assert.equal((await read({ search: "%' or true --" })).total, 0)
      assert.deepEqual(
        (await read({ sortBy: 'totalMinor', sortDir: 'asc' })).rows.map((row) => row.id),
        ['credit', 'c', 'a', 'b']
      )
      assert.equal((await read({ search: 'no matches' })).total, 0)
      assert.ok(JSON.stringify(all.rows).length < 1500)
    } finally {
      await client.query('rollback')
      await client.end()
    }
  }
)
