import assert from 'node:assert/strict'
import test from 'node:test'
import { readdir, readFile } from 'node:fs/promises'
import { registerHooks } from 'node:module'
import { Client } from 'pg'
import type { RecurringInvoiceInput } from '../shared/recurring-invoice'

test(
  'recurring invoices persist isolated templates and generate retry-safe drafts',
  { skip: !process.env.RECURRING_INVOICES_TEST_DATABASE_URL },
  async (context) => {
    const url = process.env.RECURRING_INVOICES_TEST_DATABASE_URL!
    assert.match(new URL(url).pathname, /^\/codex_recurring_invoices_test_[a-z0-9_]+$/)
    process.env.DATABASE_URL = url
    const hook = registerHooks({
      resolve(specifier, resolverContext, nextResolve) {
        if (specifier === '@nuxt-customer-portal/core/server/portal') {
          const source = `export { db } from ${JSON.stringify(new URL('../../core/server/utils/db.ts', import.meta.url).href)}; export const getPortalOrganizationsByIds = async () => []; export const listPortalOrganizationMembers = async () => []`
          return nextResolve(`data:text/javascript,${encodeURIComponent(source)}`, resolverContext)
        }
        return nextResolve(specifier, resolverContext)
      }
    })
    Object.assign(globalThis, {
      createError: (value: { statusCode: number; message: string }) => Object.assign(new Error(value.message), value),
      useRuntimeConfig: () => ({ public: { clients: { allowedTypes: ['person', 'organization'] } } })
    })
    const client = new Client({ connectionString: url })
    await client.connect()
    let pool: { end(): Promise<void> } | undefined
    try {
      for (const name of ['core', 'clients', 'invoices']) {
        const directory = new URL(`../../${name}/migrations/`, import.meta.url)
        for (const file of (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort()) {
          await client.query(await readFile(new URL(file, directory), 'utf8'))
        }
      }
      await client.query(`INSERT INTO public.organization(id,name,slug,created_at,organization_type) VALUES
      ('provider','Provider','provider',now(),'PROVIDER'),('other','Other','other',now(),'CLIENT'),
      ('client','Client','client',now(),'CLIENT'),('private','Private','private',now(),'CLIENT')`)
      await client.query(
        `INSERT INTO public."user"(id,name,email,email_verified) VALUES('owner','Owner','owner@example.test',true)`
      )
      await client.query(`INSERT INTO clients.client_profile(organization_id,client_type,official_name,address,invoice_email,first_name,last_name) VALUES
      ('client','organization','Client Ltd','Client Street 1','client@example.test',NULL,NULL),('private','person','','Private Street 1','private@example.test','Private','Client')`)
      await client.query(`INSERT INTO invoices.settings(organization_id,enabled,address,country,registration_number,vat_number,iban,bic,invoice_email) VALUES
      ('provider',true,'Sender Street 1','NL','123','NL123','NL01BANK123','BANKNL','sender@example.test'),
      ('other',true,'Other Street 1','NL','456','NL456','NL01BANK456','BANKNL','other@example.test')`)
      await client.query(
        `INSERT INTO invoices.billing_contact(id,organization_id,name,email) VALUES('contact','client','Contact','contact@example.test')`
      )
      const repository = await import('../server/utils/recurring-invoices')
      pool = (await import('@nuxt-customer-portal/core/server/utils/db')).pool
      const template: RecurringInvoiceInput = {
        name: 'Hosting',
        enabled: true,
        period: 'monthly',
        startDate: '2026-12-01',
        endDate: '2027-02-01',
        timeZone: 'Europe/Amsterdam',
        locale: 'en',
        paymentTermDays: 30,
        clientOrganizationId: 'client',
        contactId: 'contact',
        currency: 'EUR',
        subject: 'Hosting {{period}}',
        notes: '{{period_start}} — {{period_end}}',
        lines: [
          {
            description: 'Hosting {{month}} {{year}}',
            quantityMilli: 1000,
            unit: 'item',
            unitPriceMinor: 1000,
            vatRateBasisPoints: 2100
          }
        ]
      }
      const saved = await repository.saveRecurringInvoice('provider', 'owner', template)
      await context.test('organization scope, ownership, pagination and input validation', async () => {
        const list = await repository.listRecurringInvoices(
          'provider',
          repository.recurringListQuerySchema.parse({ search: 'Hosting' })
        )
        assert.equal(list.pagination.total, 1)
        assert.equal(list.items[0]!.id, saved.id)
        assert.equal(
          (await repository.listRecurringInvoices('other', repository.recurringListQuerySchema.parse({}))).pagination
            .total,
          0
        )
        await assert.rejects(repository.saveRecurringInvoice('other', 'owner', template, saved.id), { statusCode: 404 })
        await assert.rejects(
          repository.saveRecurringInvoice('provider', 'owner', { ...template, clientOrganizationId: 'missing' }),
          { statusCode: 400 }
        )
        await assert.rejects(
          repository.saveRecurringInvoice('provider', 'owner', { ...template, clientOrganizationId: 'private' }),
          { statusCode: 400 }
        )
        for (let index = 0; index < 21; index++) {
          await repository.saveRecurringInvoice('other', 'owner', {
            ...template,
            name: `Schedule ${index}`,
            enabled: false
          })
        }
        const other = await repository.listRecurringInvoices(
          'other',
          repository.recurringListQuerySchema.parse({ page: 2, enabled: 'false' })
        )
        assert.equal(other.pagination.total, 21)
        assert.equal(other.items.length, 1)
        assert.equal(other.pagination.pageCount, 2)
      })
      await context.test('no early creation and only one draft during overlapping runs', async () => {
        assert.deepEqual(await repository.generateRecurringInvoices(new Date('2026-11-30T22:59:59Z')), {
          created: 0,
          failed: 0
        })
        const results = await Promise.all(
          Array.from({ length: 4 }, () => repository.generateRecurringInvoices(new Date('2026-11-30T23:00:00Z')))
        )
        assert.equal(
          results.reduce((count, result) => count + result.created, 0),
          1
        )
        assert.equal(
          results.reduce((count, result) => count + result.failed, 0),
          0
        )
        const invoices = (await client.query('SELECT * FROM invoices.invoice')).rows
        assert.equal(invoices.length, 1)
        const draft = invoices[0]!
        assert.equal(draft.status, 'DRAFT')
        assert.equal(draft.issued_at, null)
        assert.equal(draft.recurring_invoice_id, saved.id)
        assert.equal(draft.number, '2026.0001')
        assert.equal(draft.subject, 'Hosting December 2026')
        assert.equal(draft.notes, '2026-12-01 — 2026-12-31')
        assert.equal(draft.recipient_contact_name, 'Contact')
        assert.equal(draft.recipient_email, 'contact@example.test')
        assert.equal(
          (await client.query('SELECT issue_date::text, due_date::text FROM invoices.invoice')).rows[0]!.due_date,
          '2026-12-31'
        )
        assert.equal(
          (await client.query('SELECT description FROM invoices.invoice_line')).rows[0]!.description,
          'Hosting December 2026'
        )
        assert.equal(
          (await client.query('SELECT count(*)::int AS count FROM invoices.invoice_email_delivery')).rows[0]!.count,
          0
        )
        await repository.generateRecurringInvoices(new Date('2026-12-02T12:00:00Z'))
        assert.equal((await client.query('SELECT count(*)::int AS count FROM invoices.invoice')).rows[0]!.count, 1)
      })
      await context.test('pause, immutable anchor, catch-up, inclusive end date and extension', async () => {
        await assert.rejects(
          repository.saveRecurringInvoice('provider', 'owner', { ...template, startDate: '2026-12-02' }, saved.id),
          { statusCode: 409 }
        )
        await assert.rejects(
          repository.saveRecurringInvoice('provider', 'owner', { ...template, period: 'yearly' }, saved.id),
          { statusCode: 409 }
        )
        await assert.rejects(
          repository.saveRecurringInvoice('provider', 'owner', { ...template, timeZone: 'UTC' }, saved.id),
          { statusCode: 409 }
        )
        await repository.saveRecurringInvoice('provider', 'owner', { ...template, enabled: false }, saved.id)
        assert.deepEqual(await repository.generateRecurringInvoices(new Date('2027-03-01T12:00:00Z')), {
          created: 0,
          failed: 0
        })
        await repository.saveRecurringInvoice('provider', 'owner', template, saved.id)
        assert.deepEqual(await repository.generateRecurringInvoices(new Date('2027-03-01T12:00:00Z')), {
          created: 2,
          failed: 0
        })
        assert.deepEqual(await repository.generateRecurringInvoices(new Date('2027-03-01T12:00:00Z')), {
          created: 0,
          failed: 0
        })
        assert.equal(
          (await client.query('SELECT next_date FROM invoices.recurring_invoice WHERE id=$1', [saved.id])).rows[0]!
            .next_date,
          null
        )
        await client.query('DELETE FROM invoices.invoice WHERE scheduled_date=$1', ['2027-02-01'])
        assert.deepEqual(await repository.generateRecurringInvoices(new Date('2027-03-01T12:00:00Z')), {
          created: 0,
          failed: 0
        })
        await repository.saveRecurringInvoice('provider', 'owner', { ...template, endDate: '2027-03-01' }, saved.id)
        assert.deepEqual(await repository.generateRecurringInvoices(new Date('2027-03-01T12:00:00Z')), {
          created: 1,
          failed: 0
        })
      })
      await context.test('past start dates catch up in one run without generating future invoices', async () => {
        const catchup = await repository.saveRecurringInvoice('provider', 'owner', {
          ...template,
          name: 'Past start date',
          startDate: '2027-01-31',
          endDate: null,
          contactId: null
        })
        const results = await Promise.all(
          Array.from({ length: 4 }, () => repository.generateRecurringInvoices(new Date('2027-04-01T12:00:00Z')))
        )
        assert.equal(
          results.reduce((sum, result) => sum + result.created, 0),
          3
        )
        assert.equal(
          results.reduce((sum, result) => sum + result.failed, 0),
          0
        )
        const drafts = (
          await client.query(
            'SELECT scheduled_date::text, status, subject FROM invoices.invoice WHERE recurring_invoice_id=$1 ORDER BY scheduled_date',
            [catchup.id]
          )
        ).rows
        assert.deepEqual(
          drafts.map((draft) => draft.scheduled_date),
          ['2027-01-31', '2027-02-28', '2027-03-31']
        )
        assert.ok(drafts.every((draft) => draft.status === 'DRAFT'))
        assert.deepEqual(
          drafts.map((draft) => draft.subject),
          ['Hosting January 2027', 'Hosting February 2027', 'Hosting March 2027']
        )
        const row = (
          await client.query(
            'SELECT next_date::text, last_generated_date::text FROM invoices.recurring_invoice WHERE id=$1',
            [catchup.id]
          )
        ).rows[0]!
        assert.equal(row.next_date, '2027-04-30')
        assert.equal(row.last_generated_date, '2027-03-31')
        assert.deepEqual(await repository.generateRecurringInvoices(new Date('2027-04-01T12:00:00Z')), {
          created: 0,
          failed: 0
        })
        await repository.saveRecurringInvoice(
          'provider',
          'owner',
          { ...template, startDate: '2027-01-31', endDate: null, contactId: null, enabled: false },
          catchup.id
        )
      })
      await context.test('failed generation rolls back and retries the same date without duplicates', async () => {
        const failing = await repository.saveRecurringInvoice('provider', 'owner', {
          ...template,
          name: 'Retry',
          startDate: '2027-04-01',
          endDate: '2027-04-01'
        })
        await client.query("UPDATE invoices.settings SET address='' WHERE organization_id='provider'")
        assert.deepEqual(await repository.generateRecurringInvoices(new Date('2027-04-01T12:00:00Z')), {
          created: 0,
          failed: 1
        })
        let row = (
          await client.query(
            'SELECT next_date::text, last_generated_date, last_error FROM invoices.recurring_invoice WHERE id=$1',
            [failing.id]
          )
        ).rows[0]!
        assert.equal(row.next_date, '2027-04-01')
        assert.equal(row.last_generated_date, null)
        assert.ok(row.last_error)
        await client.query(
          "UPDATE invoices.settings SET address='Fixed Street 1', enabled=false WHERE organization_id='provider'"
        )
        assert.deepEqual(await repository.generateRecurringInvoices(new Date('2027-04-01T12:00:00Z')), {
          created: 0,
          failed: 0
        })
        await client.query("UPDATE invoices.settings SET enabled=true WHERE organization_id='provider'")
        assert.deepEqual(await repository.generateRecurringInvoices(new Date('2027-04-01T12:00:00Z')), {
          created: 1,
          failed: 0
        })
        row = (
          await client.query(
            'SELECT next_date, last_generated_date::text, last_error FROM invoices.recurring_invoice WHERE id=$1',
            [failing.id]
          )
        ).rows[0]!
        assert.equal(row.last_generated_date, '2027-04-01')
        assert.equal(row.last_error, null)
        assert.equal(row.next_date, null)
      })
      await context.test('unavailable relations can be kept while pausing, but cannot be newly assigned', async () => {
        await client.query("UPDATE clients.client_profile SET archived_at=now() WHERE organization_id='client'")
        await repository.saveRecurringInvoice('provider', 'owner', { ...template, enabled: false }, saved.id)
        await assert.rejects(repository.saveRecurringInvoice('provider', 'owner', template), { statusCode: 400 })
        await client.query("DELETE FROM invoices.billing_contact WHERE id='contact'")
        await repository.saveRecurringInvoice('provider', 'owner', { ...template, enabled: false }, saved.id)
      })
      await context.test('line insert failures roll back the draft, history and cursor together', async () => {
        const atomic = await repository.saveRecurringInvoice('provider', 'owner', {
          ...template,
          clientOrganizationId: 'private',
          contactId: null,
          startDate: '2027-05-01',
          endDate: '2027-05-01'
        })
        const before = (await client.query('SELECT count(*)::int AS count FROM invoices.invoice')).rows[0]!.count
        const historyBefore = (await client.query('SELECT count(*)::int AS count FROM invoices.invoice_history'))
          .rows[0]!.count
        await client.query(`CREATE FUNCTION invoices.reject_test_line() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Test failure after invoice insert'; END $$;
          CREATE TRIGGER reject_test_line BEFORE INSERT ON invoices.invoice_line FOR EACH ROW EXECUTE FUNCTION invoices.reject_test_line()`)
        assert.deepEqual(await repository.generateRecurringInvoices(new Date('2027-05-01T12:00:00Z')), {
          created: 0,
          failed: 1
        })
        assert.equal((await client.query('SELECT count(*)::int AS count FROM invoices.invoice')).rows[0]!.count, before)
        assert.equal(
          (await client.query('SELECT count(*)::int AS count FROM invoices.invoice_history')).rows[0]!.count,
          historyBefore
        )
        assert.equal(
          (await client.query('SELECT next_date::text FROM invoices.recurring_invoice WHERE id=$1', [atomic.id]))
            .rows[0]!.next_date,
          '2027-05-01'
        )
        await client.query(
          'DROP TRIGGER reject_test_line ON invoices.invoice_line; DROP FUNCTION invoices.reject_test_line()'
        )
        assert.deepEqual(await repository.generateRecurringInvoices(new Date('2027-05-01T12:00:00Z')), {
          created: 1,
          failed: 0
        })
      })
      await context.test('catch-up keeps committed drafts and retries from a failed occurrence', async () => {
        const retry = await repository.saveRecurringInvoice('provider', 'owner', {
          ...template,
          clientOrganizationId: 'private',
          contactId: null,
          period: 'daily',
          startDate: '2027-05-02',
          endDate: '2027-05-04'
        })
        await client.query(`CREATE FUNCTION invoices.reject_test_occurrence() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN
            IF EXISTS (SELECT 1 FROM invoices.invoice WHERE id=NEW.invoice_id AND issue_date='2027-05-03') THEN
              RAISE EXCEPTION 'Test failure on second catch-up draft';
            END IF;
            RETURN NEW;
          END $$;
          CREATE TRIGGER reject_test_occurrence BEFORE INSERT ON invoices.invoice_line FOR EACH ROW EXECUTE FUNCTION invoices.reject_test_occurrence()`)
        assert.deepEqual(await repository.generateRecurringInvoices(new Date('2027-05-04T12:00:00Z')), {
          created: 1,
          failed: 1
        })
        const row = (
          await client.query(
            'SELECT next_date::text, last_generated_date::text, last_error FROM invoices.recurring_invoice WHERE id=$1',
            [retry.id]
          )
        ).rows[0]!
        assert.equal(row.next_date, '2027-05-03')
        assert.equal(row.last_generated_date, '2027-05-02')
        assert.ok(row.last_error)
        await client.query(
          'DROP TRIGGER reject_test_occurrence ON invoices.invoice_line; DROP FUNCTION invoices.reject_test_occurrence()'
        )
        assert.deepEqual(await repository.generateRecurringInvoices(new Date('2027-05-04T12:00:00Z')), {
          created: 2,
          failed: 0
        })
        const drafts = (
          await client.query(
            'SELECT scheduled_date::text FROM invoices.invoice WHERE recurring_invoice_id=$1 ORDER BY scheduled_date',
            [retry.id]
          )
        ).rows
        assert.deepEqual(
          drafts.map((draft) => draft.scheduled_date),
          ['2027-05-02', '2027-05-03', '2027-05-04']
        )
        assert.deepEqual(await repository.generateRecurringInvoices(new Date('2027-05-04T12:00:00Z')), {
          created: 0,
          failed: 0
        })
      })
      await context.test('billing in arrears renders previous periods without changing invoice dates', async () => {
        const arrears = await repository.saveRecurringInvoice('provider', 'owner', {
          ...template,
          clientOrganizationId: 'private',
          contactId: null,
          startDate: '2027-11-01',
          endDate: '2027-11-01',
          subject: 'Hosting {{previous_period}}',
          notes: '{{previous_period_start}} — {{previous_period_end}}',
          lines: [{ ...template.lines[0]!, description: '{{previous_month}} {{previous_year}}' }]
        })
        assert.deepEqual(await repository.generateRecurringInvoices(new Date('2027-11-01T12:00:00Z')), {
          created: 1,
          failed: 0
        })
        const row = (
          await client.query(
            `SELECT invoice.issue_date::text, invoice.due_date::text, invoice.subject, invoice.notes, line.description
           FROM invoices.invoice AS invoice JOIN invoices.invoice_line AS line ON line.invoice_id=invoice.id
           WHERE invoice.recurring_invoice_id=$1`,
            [arrears.id]
          )
        ).rows[0]!
        assert.equal(row.issue_date, '2027-11-01')
        assert.equal(row.due_date, '2027-12-01')
        assert.equal(row.subject, 'Hosting October 2027')
        assert.equal(row.notes, '2027-10-01 — 2027-10-31')
        assert.equal(row.description, 'October 2027')
      })
      await context.test('bounded batches generate multiple schedules with unique invoice numbers', async () => {
        for (let index = 0; index < 52; index++) {
          await repository.saveRecurringInvoice('provider', 'owner', {
            ...template,
            name: `Batch ${index}`,
            clientOrganizationId: 'private',
            contactId: null,
            startDate: '2027-06-01',
            endDate: '2027-06-01'
          })
        }
        const results = await Promise.all([
          repository.generateRecurringInvoices(new Date('2027-06-01T12:00:00Z')),
          repository.generateRecurringInvoices(new Date('2027-06-01T12:00:00Z'))
        ])
        assert.ok(results.every((result) => result.created <= 50))
        assert.equal(
          results.reduce((sum, result) => sum + result.failed, 0),
          0
        )
        await repository.generateRecurringInvoices(new Date('2027-06-01T12:00:00Z'))
        const batch = (
          await client.query(
            "SELECT count(*)::int AS count, count(DISTINCT number)::int AS numbers FROM invoices.invoice WHERE scheduled_date='2027-06-01'"
          )
        ).rows[0]!
        assert.equal(batch.count, 52)
        assert.equal(batch.numbers, 52)
        assert.deepEqual(await repository.generateRecurringInvoices(new Date('2027-06-01T12:00:00Z')), {
          created: 0,
          failed: 0
        })
      })
    } finally {
      await pool?.end()
      await client.end()
      hook.deregister()
    }
  }
)
