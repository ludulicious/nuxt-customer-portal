import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'

const require = createRequire(import.meta.url)
const databaseUrl = process.env.TEST_REVIEW_DATABASE_URL

test('client period requests against isolated PostgreSQL', { skip: !databaseUrl }, async (t) => {
  const admin = new Pool({ connectionString: databaseUrl })
  const name = `portal_review_test_${process.pid}`
  await admin.query(`CREATE DATABASE ${name}`)
  const url = new URL(databaseUrl!)
  url.pathname = `/${name}`
  const pool = new Pool({ connectionString: url.href })
  const db = drizzle(pool)
  const notifications: Array<[string, string]> = []
  const invoiced = new Set<string>()
  try {
    await pool.query(`
      CREATE TABLE public.organization (id text PRIMARY KEY, name text NOT NULL, logo text, metadata text);
      CREATE TABLE public."user" (id text PRIMARY KEY, name text NOT NULL, email text NOT NULL);
      CREATE TABLE public.member (id text PRIMARY KEY, organization_id text NOT NULL, user_id text NOT NULL, role text NOT NULL);
      CREATE SCHEMA clients;
      CREATE TABLE clients.client_profile (organization_id text PRIMARY KEY, archived_at timestamp);
      CREATE TABLE clients.client_module (organization_id text, module_id text, enabled boolean);
      CREATE SCHEMA timesheets;
      CREATE TABLE timesheets.workspace_settings (organization_id text PRIMARY KEY, timezone text, week_starts_on integer);
      CREATE TABLE timesheets.workspace_client (id text PRIMARY KEY, workspace_organization_id text NOT NULL, client_organization_id text NOT NULL, access_mode text NOT NULL);
      CREATE TABLE timesheets.workspace_client_reviewer (workspace_client_id text, user_id text);
      CREATE TABLE timesheets.submission (id text PRIMARY KEY, status text NOT NULL);
      CREATE TABLE timesheets.project (id text PRIMARY KEY, name text NOT NULL);
      CREATE TABLE timesheets.activity_type (id text PRIMARY KEY, name text NOT NULL);
      CREATE TABLE timesheets.time_entry (id text PRIMARY KEY, organization_id text NOT NULL, client_organization_id text NOT NULL, submission_id text, user_id text, project_id text, activity_type_id text, entry_date date, duration_minutes integer, note text, billable_snapshot boolean, hourly_rate_minor_snapshot integer, currency_snapshot text, timer_started_at timestamp, externally_billed boolean NOT NULL DEFAULT false, import_metadata jsonb);
      CREATE TABLE timesheets.client_review (id text PRIMARY KEY, submission_id text, client_organization_id text);
    `)
    await pool.query(readFileSync(new URL('../migrations/0007_client_review_requests.sql', import.meta.url), 'utf8'))
    await pool.query(`
      UPDATE timesheets.client_review_rollout SET starts_on = '2020-01-01';
      INSERT INTO public.organization (id, name) VALUES ('provider','Provider'), ('client','Client'), ('other','Other'), ('outsider','Outsider');
      UPDATE public.organization SET logo = 'client-logo.png', metadata = '{"avatarLogo":"client-avatar.png"}' WHERE id = 'client';
      UPDATE public.organization SET logo = 'supplier-logo.png', metadata = 'invalid' WHERE id = 'provider';
      INSERT INTO public."user" VALUES ('sender','Sender','sender@example.com'), ('person','Person','person@example.com'), ('person2','Second','second@example.com'), ('reviewer','Reviewer','reviewer@example.com'), ('stranger','Stranger','stranger@example.com');
      INSERT INTO clients.client_profile VALUES ('client', null), ('other', null);
      INSERT INTO clients.client_module VALUES ('client', 'timesheets', true), ('other', 'timesheets', true);
      INSERT INTO public.member VALUES ('m1','client','reviewer','member');
      INSERT INTO timesheets.workspace_settings VALUES ('provider','Europe/Amsterdam',1);
      INSERT INTO timesheets.workspace_client VALUES ('link','provider','client','REVIEW'), ('link2','provider','other','REVIEW');
      INSERT INTO timesheets.client_review_schedule VALUES ('link', '1900-01-01', 'WEEKLY'), ('link2', '1900-01-01', 'WEEKLY');
      INSERT INTO timesheets.workspace_client_reviewer VALUES ('link','reviewer');
      INSERT INTO timesheets.project VALUES ('project','Project');
      INSERT INTO timesheets.activity_type VALUES ('activity','Activity');
      INSERT INTO timesheets.submission VALUES ('submission','APPROVED'), ('second','APPROVED'), ('draft','SUBMITTED');
      INSERT INTO timesheets.time_entry VALUES
        ('legacy','provider','client','submission','person','project','activity','2019-12-31',60,null,true,10000,'EUR',null),
        ('entry','provider','client','submission','person','project','activity','2020-01-01',60,'Original',true,10000,'EUR',null),
        ('entry2','provider','client','second','person2','project','activity','2020-01-05',120,null,true,10000,'EUR',null),
        ('outstanding','provider','client','draft','person','project','activity','2020-01-03',30,null,true,10000,'EUR',null);
    `)
    const exports = {} as typeof import('../server/utils/client-review-requests')
    runInNewContext(
      ts.transpileModule(readFileSync(new URL('../server/utils/client-review-requests.ts', import.meta.url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
      }).outputText,
      {
        exports,
        createError: (input: { message: string }) => Object.assign(new Error(input.message), input),
        require: (id: string) => {
          if (id.endsWith('/shared/organization-avatar')) {
            return require('../../core/shared/organization-avatar')
          }
          if (id.endsWith('/server/portal')) {
            return { db }
          }
          if (id.endsWith('/business-hooks')) {
            return {
              assertTimeEntriesReopenable: async (_org: string, ids: string[]) => {
                if (ids.some((id) => invoiced.has(id))) {
                  throw new Error('Invoiced timesheets cannot be reopened')
                }
              }
            }
          }
          if (id === './client-review-request-email') {
            return {
              notifyReviewRequest: async (id: string, action: string) => {
                notifications.push([id, action])
              }
            }
          }
          if (id === '../../shared/client-review-periods') {
            return require('../shared/client-review-periods')
          }
          return require(id)
        }
      }
    )
    await pool.query(`
      ALTER TABLE timesheets.time_entry ADD COLUMN weekly_timesheet_id text, ADD COLUMN created_at timestamp DEFAULT now(), ADD COLUMN updated_at timestamp DEFAULT now();
      ALTER TABLE timesheets.submission ADD COLUMN organization_id text DEFAULT 'provider';
      ALTER TABLE timesheets.client_review ADD COLUMN status text DEFAULT 'PENDING', ADD COLUMN comment text;
      CREATE SCHEMA invoices;
      CREATE TABLE invoices.invoice (id text PRIMARY KEY, organization_id text, status text);
      CREATE TABLE invoices.invoice_line (id text PRIMARY KEY, invoice_id text, position integer, description text, quantity_milli integer, unit text, unit_price_minor integer, vat_rate_basis_points integer, exact_tax_minor integer, tax_details jsonb);
      CREATE SCHEMA invoice_timesheets;
      CREATE TABLE invoice_timesheets.invoice_time_entry (id text PRIMARY KEY, invoice_id text, invoice_line_id text, time_entry_id text);
    `)
    const bridge = {} as typeof import('../../invoice-timesheets/server/utils/invoice-timesheets')
    runInNewContext(
      ts.transpileModule(
        readFileSync(new URL('../../invoice-timesheets/server/utils/invoice-timesheets.ts', import.meta.url), 'utf8'),
        { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
      ).outputText,
      {
        exports: bridge,
        createError: (input: { message: string }) => Object.assign(new Error(input.message), input),
        require: (id: string) => {
          if (id.endsWith('/server/portal')) {
            return { db }
          }
          if (id.endsWith('/server/utils/client-review-requests')) {
            return exports
          }
          if (id.endsWith('/invoices/server/utils/invoice-repository')) {
            return {
              requireInvoicesEnabled: async () => {},
              createInvoiceInTransaction: async () => {
                throw new Error('Unexpected invoice creation')
              }
            }
          }
          if (id.endsWith('/timesheets/server/utils/timesheet-repository')) {
            return {
              requireTimesheetWorkspace: async () => {},
              getReport: async () => ({
                rows: (
                  await pool.query(
                    `select e.id as "entryId", e.entry_date::text as date from timesheets.time_entry e join timesheets.submission s on s.id = e.submission_id where s.status = 'APPROVED' and e.billable_snapshot`
                  )
                ).rows
              })
            }
          }
          return require(id)
        }
      }
    )
    const invoiceSources = async () =>
      new Set((await bridge.listTimesheetInvoiceSources('provider')).entries.map((e) => e.entryId))
    const invoiceInput = {
      clientOrganizationId: 'client',
      number: 'TEST-1',
      currency: 'EUR',
      issueDate: '2020-01-06',
      dueDate: '2020-02-06',
      lines: [
        {
          description: 'Time',
          quantityMilli: 1000,
          unit: 'hour',
          unitPriceMinor: 10000,
          vatRateBasisPoints: 2100,
          timeEntryIds: ['entry']
        }
      ]
    }
    const send = () =>
      exports.sendReviewRequest('provider', 'sender', 'link', '2020-01-01', '2020-01-05', 'Please review')
    let requestId = ''
    await t.test('monthly defaults combine submitted weeks and partial weeks without draft blockers', async () => {
      await pool.query("DELETE FROM timesheets.client_review_schedule WHERE workspace_client_id = 'link2'")
      await pool.query("INSERT INTO public.member VALUES ('monthly-reviewer', 'other', 'reviewer', 'member')")
      await pool.query("INSERT INTO timesheets.workspace_client_reviewer VALUES ('link2', 'reviewer')")
      await pool.query(`INSERT INTO timesheets.submission (id, status) VALUES
        ('monthly-approved', 'APPROVED'), ('monthly-pending', 'SUBMITTED'),
        ('monthly-draft', 'DRAFT'), ('monthly-rejected', 'REJECTED');
        INSERT INTO timesheets.time_entry
          (id, organization_id, client_organization_id, submission_id, user_id, project_id, activity_type_id,
            entry_date, duration_minutes, billable_snapshot, hourly_rate_minor_snapshot, currency_snapshot)
        VALUES
          ('monthly-first', 'provider', 'other', 'monthly-approved', 'person', 'project', 'activity', '2020-03-02', 60, true, 10000, 'EUR'),
          ('monthly-partial', 'provider', 'other', 'monthly-approved', 'person', 'project', 'activity', '2020-03-05', 90, true, 10000, 'EUR'),
          ('monthly-pending', 'provider', 'other', 'monthly-pending', 'person', 'project', 'activity', '2020-03-09', 30, true, 10000, 'EUR'),
          ('monthly-unsubmitted', 'provider', 'other', null, 'person', 'project', 'activity', '2020-03-06', 120, true, 10000, 'EUR'),
          ('monthly-draft', 'provider', 'other', 'monthly-draft', 'person', 'project', 'activity', '2020-03-07', 120, true, 10000, 'EUR'),
          ('monthly-rejected', 'provider', 'other', 'monthly-rejected', 'person', 'project', 'activity', '2020-03-08', 120, true, 10000, 'EUR'),
          ('monthly-previous', 'provider', 'other', 'monthly-approved', 'person', 'project', 'activity', '2020-02-29', 120, true, 10000, 'EUR')`)
      let sentId: string | undefined
      try {
        assert.equal(await exports.getReviewInterval(db, 'link2', '2020-03-01'), 'MONTHLY')
        assert.equal((await exports.getClientReviewSettings('provider', 'other')).reviewInterval, 'MONTHLY')
        assert.equal((await exports.getClientReviewSettings('provider', 'outsider')).reviewInterval, 'MONTHLY')
        const periods = (await exports.listReviewPeriods('provider', '2020-03')).filter(
          (period) => period.workspaceClientId === 'link2'
        )
        assert.equal(periods.length, 1)
        const period = periods[0]!
        assert.equal(period.interval, 'MONTHLY')
        assert.equal(period.startsOn, '2020-03-01')
        assert.equal(period.endsOn, '2020-03-31')
        assert.equal(period.totalMinutes, 180)
        assert.equal(period.availableCount, 3)
        assert.equal(period.outstandingCount, 1)
        assert.equal(period.outstandingEntries[0]!.id, 'monthly-pending')
        assert.equal(period.canSend, false)
        await assert.rejects(
          exports.sendReviewRequest('provider', 'sender', 'link2', period.startsOn, period.endsOn),
          /Resolve outstanding/
        )
        await pool.query("UPDATE timesheets.submission SET status = 'APPROVED' WHERE id = 'monthly-pending'")
        const ready = (await exports.listReviewPeriods('provider', '2020-03')).find(
          (period) => period.workspaceClientId === 'link2'
        )!
        assert.equal(ready.canSend, true)
        assert.equal(ready.outstandingCount, 0)
        sentId = (await exports.sendReviewRequest('provider', 'sender', 'link2', ready.startsOn, ready.endsOn)).id
        const sent = (await exports.listReviewRequests('provider', 'sender', false, true)).find(
          (request) => request.id === sentId
        )!
        assert.deepEqual(Array.from(sent.entries, (entry) => entry.id).sort(), [
          'monthly-first',
          'monthly-partial',
          'monthly-pending'
        ])
        assert.equal(
          sent.entries.reduce((sum, entry) => sum + entry.minutes, 0),
          180
        )
      } finally {
        if (sentId) {
          await exports.actOnReviewRequest('provider', 'sender', true, sentId, 1, 'WITHDRAW')
          await pool.query('DELETE FROM timesheets.client_review_request_event WHERE request_id = $1', [sentId])
          await pool.query('DELETE FROM timesheets.client_review_request_entry WHERE request_id = $1', [sentId])
          await pool.query('DELETE FROM timesheets.client_review_request WHERE id = $1', [sentId])
        }
        await pool.query("DELETE FROM timesheets.time_entry WHERE id LIKE 'monthly-%'")
        await pool.query("DELETE FROM timesheets.submission WHERE id LIKE 'monthly-%'")
        await pool.query("DELETE FROM timesheets.workspace_client_reviewer WHERE workspace_client_id = 'link2'")
        await pool.query("DELETE FROM public.member WHERE id = 'monthly-reviewer'")
        await pool.query("INSERT INTO timesheets.client_review_schedule VALUES ('link2', '1900-01-01', 'WEEKLY')")
        notifications.length = 0
      }
    })
    await t.test(
      'blocks outstanding and empty periods, invalid boundaries, open periods, and missing reviewers',
      async () => {
        await assert.rejects(send(), /Resolve outstanding/)
        await assert.rejects(
          exports.sendReviewRequest('provider', 'sender', 'link', '2020-01-01', '2020-01-04'),
          /Invalid review period/
        )
        await assert.rejects(
          exports.sendReviewRequest('provider', 'sender', 'link', '2020-02-03', '2020-02-09'),
          /No unrequested time/
        )
        await assert.rejects(
          exports.sendReviewRequest('provider', 'sender', 'link2', '2020-01-01', '2020-01-05'),
          /No unrequested time/
        )
        await pool.query("UPDATE timesheets.submission SET status = 'APPROVED' WHERE id = 'draft'")
        await pool.query('DELETE FROM timesheets.workspace_client_reviewer')
        await assert.rejects(send(), /Assign an eligible/)
        await pool.query("INSERT INTO timesheets.workspace_client_reviewer VALUES ('link','reviewer')")
        const future = (await exports.listReviewPeriods('provider', '2099-01')).find(
          (period) => period.workspaceClientId === 'link'
        )!
        assert.equal(future.clientAvatar, 'client-avatar.png')
        await assert.rejects(
          exports.sendReviewRequest('provider', 'sender', 'link', future.startsOn, future.endsOn),
          /has not ended/
        )
      }
    )
    await t.test('concurrent sends create exactly one request with combined immutable snapshots', async () => {
      const results = await Promise.allSettled([send(), send()])
      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
      requestId = (results.find((r) => r.status === 'fulfilled') as PromiseFulfilledResult<{ id: string }>).value.id
      const requests = await exports.listReviewRequests('client', 'reviewer', true, false)
      assert.equal(requests.length, 1)
      assert.equal(requests[0]!.clientAvatar, 'client-avatar.png')
      assert.equal(requests[0]!.supplierAvatar, 'supplier-logo.png')
      assert.ok(!('clientBranding' in requests[0]!))
      assert.ok(!('supplierBranding' in requests[0]!))
      assert.equal(requests[0]!.entries.length, 3)
      assert.ok(!('rate' in requests[0]!.entries[0]!))
      assert.equal((await exports.listReviewRequests('provider', 'sender', false, true))[0]!.entries[0]!.rate, 10000)
      assert.equal(
        requests[0]!.entries.reduce((sum, e) => sum + e.minutes, 0),
        210
      )
      assert.ok(!requests[0]!.entries.some((e) => e.id === 'legacy'))
      assert.equal(notifications.length, 1)
      assert.ok(!(await invoiceSources()).has('entry'))
      assert.ok((await invoiceSources()).has('legacy'))
      await assert.rejects(
        bridge.createInvoiceFromTimesheets('provider', 'sender', invoiceInput),
        /unavailable for invoicing/
      )
      await assert.rejects(
        pool.query("UPDATE timesheets.time_entry SET note = 'Changed' WHERE id = 'entry'"),
        /Withdraw affected/
      )
      await assert.rejects(
        pool.query("UPDATE timesheets.submission SET status = 'DRAFT' WHERE id = 'submission'"),
        /Withdraw affected/
      )
      await assert.rejects(exports.assertNoActiveReviewRequests(db, ['entry']), /Withdraw affected/)
    })
    await t.test('turning tracking off preserves monthly hours and approval requests', async () => {
      await pool.query("UPDATE clients.client_module SET enabled = false WHERE organization_id = 'client'")
      await pool.query(`INSERT INTO timesheets.time_entry
        (id, organization_id, client_organization_id, submission_id, user_id, project_id, activity_type_id, entry_date, duration_minutes, billable_snapshot, hourly_rate_minor_snapshot, currency_snapshot)
        VALUES ('off-late', 'provider', 'client', 'second', 'person', 'project', 'activity', '2020-01-03', 15, true, 10000, 'EUR')`)
      try {
        const periods = await exports.listReviewPeriods('provider', '2020-01')
        const period = periods.find((period) => period.workspaceClientId === 'link' && period.availableCount > 0)!
        assert.equal(period.totalMinutes, 15)
        assert.equal(period.canSend, true)
        const sent = await send()
        assert.ok(
          (await exports.listReviewRequests('provider', 'sender', false, true)).some(
            (request) => request.id === requestId
          )
        )
        await exports.actOnReviewRequest('provider', 'sender', true, sent.id, 1, 'WITHDRAW')
        // Keep this fixture independent of the replacement-history scenarios below.
        for (const table of [
          'client_review_request_event',
          'client_review_request_entry',
          'client_review_request_replacement'
        ]) {
          await pool.query(`DELETE FROM timesheets.${table} WHERE request_id = $1`, [sent.id])
        }
        await pool.query('DELETE FROM timesheets.client_review_request WHERE id = $1', [sent.id])
        await pool.query("UPDATE timesheets.workspace_client SET access_mode = 'DISABLED' WHERE id = 'link'")
        const disabledPeriod = (await exports.listReviewPeriods('provider', '2020-01')).find(
          (candidate) => candidate.workspaceClientId === 'link' && candidate.startsOn === period.startsOn
        )!
        assert.equal(disabledPeriod.totalMinutes, 0)
        const automatic = (await exports.listSubmissionReviewRequests('provider')).find((request) =>
          request.entries.some((entry) => entry.id === 'off-late')
        )!
        assert.equal(automatic.status, 'AUTO_APPROVED')
        assert.equal(
          automatic.entries.reduce((sum, entry) => sum + entry.minutes, 0),
          15
        )
        assert.equal(disabledPeriod.reviewEnabled, false)
        assert.equal(disabledPeriod.canSend, false)
        await assert.rejects(send(), /Review-enabled client relationship not found/)
      } finally {
        await pool.query("UPDATE clients.client_module SET enabled = true WHERE organization_id = 'client'")
        await pool.query("UPDATE timesheets.workspace_client SET access_mode = 'REVIEW' WHERE id = 'link'")
        await pool.query("DELETE FROM timesheets.time_entry WHERE id = 'off-late'")
      }
    })
    await t.test('scopes requests and decisions to authorized provider/client actors and versions', async () => {
      assert.equal((await exports.listReviewRequests('outsider', 'reviewer', true, true)).length, 0)
      assert.equal((await exports.listReviewRequests('client', 'stranger', true, false)).length, 0)
      await assert.rejects(
        exports.actOnReviewRequest('client', 'stranger', false, requestId, 1, 'APPROVE'),
        /reviewer access/
      )
      await assert.rejects(
        exports.actOnReviewRequest('outsider', 'reviewer', true, requestId, 1, 'APPROVE'),
        /review access/
      )
      await assert.rejects(
        exports.actOnReviewRequest('provider', 'sender', false, requestId, 1, 'WITHDRAW'),
        /administrator access/
      )
      await assert.rejects(
        exports.actOnReviewRequest('client', 'reviewer', false, requestId, 1, 'DISPUTE', ' '),
        /comment is required/
      )
      await exports.actOnReviewRequest('client', 'reviewer', false, requestId, 1, 'DISPUTE', 'Please correct')
      assert.ok(!(await invoiceSources()).has('entry'))
      await assert.rejects(exports.actOnReviewRequest('client', 'reviewer', false, requestId, 1, 'APPROVE'), /changed/)
    })
    await t.test('withdraw, correct, internally reapprove and replace preserve prior values and events', async () => {
      await exports.actOnReviewRequest('provider', 'sender', true, requestId, 2, 'WITHDRAW', 'Correcting')
      assert.ok(!(await invoiceSources()).has('entry'))
      await pool.query("UPDATE timesheets.submission SET status = 'DRAFT' WHERE id = 'submission'")
      await pool.query("UPDATE timesheets.time_entry SET duration_minutes = 90 WHERE id = 'entry'")
      const reopened = (await exports.listReviewPeriods('provider', '2020-01')).find(
        (period) => period.workspaceClientId === 'link' && period.startsOn === '2020-01-01'
      )!
      assert.equal(reopened.outstandingCount, 0)
      await pool.query("UPDATE timesheets.submission SET status = 'SUBMITTED' WHERE id = 'submission'")
      await assert.rejects(send(), /Resolve outstanding/)
      await pool.query("UPDATE timesheets.submission SET status = 'APPROVED' WHERE id = 'submission'")
      const replacement = await send()
      const requests = await exports.listReviewRequests('provider', 'sender', false, true)
      assert.equal(requests.find((r) => r.id === requestId)!.entries.find((e) => e.id === 'entry')!.minutes, 60)
      assert.equal(requests.find((r) => r.id === requestId)!.history.length, 3)
      assert.equal(requests.find((r) => r.id === replacement.id)!.replacesId, requestId)
      assert.equal(requests.find((r) => r.id === replacement.id)!.entries.find((e) => e.id === 'entry')!.minutes, 90)
      await exports.actOnReviewRequest('client', 'reviewer', false, replacement.id, 1, 'APPROVE')
      requestId = replacement.id
      assert.ok((await invoiceSources()).has('entry'))
      assert.equal(requests.find((r) => r.id === replacement.id)!.supplementary, false)
    })
    await t.test(
      'historically billed time cannot be selected, directly invoiced or reopened without an invoice link',
      async () => {
        await pool.query(
          "INSERT INTO timesheets.time_entry (id, organization_id, client_organization_id, submission_id, user_id, project_id, activity_type_id, entry_date, duration_minutes, billable_snapshot, externally_billed, hourly_rate_minor_snapshot, currency_snapshot) VALUES ('historical','provider','client','submission','person','project','activity','2019-12-31',60,true,true,10000,'EUR')"
        )
        assert.ok(!(await invoiceSources()).has('historical'))
        await assert.rejects(
          bridge.createInvoiceFromTimesheets('provider', 'sender', {
            ...invoiceInput,
            lines: [{ ...invoiceInput.lines[0]!, timeEntryIds: ['historical'] }]
          }),
          /unavailable for invoicing/
        )
        assert.equal(await bridge.hasActiveInvoiceSource('provider', ['historical']), true)
        await pool.query("DELETE FROM timesheets.time_entry WHERE id = 'historical'")
      }
    )
    await t.test('late time creates a supplement and does not alter previous approval', async () => {
      await pool.query(
        "INSERT INTO timesheets.time_entry (id, organization_id, client_organization_id, submission_id, user_id, project_id, activity_type_id, entry_date, duration_minutes, note, billable_snapshot, hourly_rate_minor_snapshot, currency_snapshot, timer_started_at) VALUES ('late','provider','client','second','person2','project','activity','2020-01-02',45,null,true,10000,'EUR',null)"
      )
      const supplement = await send()
      const requests = await exports.listReviewRequests('client', 'reviewer', true, false)
      assert.equal(requests.find((r) => r.id === requestId)!.status, 'APPROVED')
      assert.equal(requests.find((r) => r.id === supplement.id)!.supplementary, true)
      assert.equal(requests.find((r) => r.id === supplement.id)!.entries.length, 1)
      assert.equal(requests.find((r) => r.id === supplement.id)!.replacesId, null)
      assert.ok(!(await invoiceSources()).has('late'))
      assert.ok((await invoiceSources()).has('entry'))
      invoiced.add('entry')
      await assert.rejects(exports.actOnReviewRequest('provider', 'sender', true, requestId, 2, 'WITHDRAW'), /Invoiced/)
    })
    await t.test('setting changes start next month and preserve historical period boundaries', async () => {
      const before = await exports.getClientReviewSettings('provider', 'client')
      await exports.scheduleClientReviewInterval('provider', 'client', 'MONTHLY')
      const after = await exports.getClientReviewSettings('provider', 'client')
      assert.equal(after.reviewInterval, before.reviewInterval)
      assert.equal(after.scheduledReviewInterval, 'MONTHLY')
      assert.equal(await exports.getReviewInterval(db, 'link', '2020-01-01'), 'WEEKLY')
      assert.equal(await exports.getReviewInterval(db, 'link', after.reviewIntervalEffectiveOn!), 'MONTHLY')
    })
    await t.test('interval changes protect all requests in the starting month or later', async () => {
      const today = await exports.reviewToday(db, 'provider')
      const monthStart = `${today.slice(0, 7)}-01`
      assert.equal((await exports.getClientReviewSettings('provider', 'other')).canChangeCurrentMonth, true)
      await pool.query(
        `INSERT INTO timesheets.client_review_request
        (id, workspace_client_id, starts_on, ends_on, revision, sent_by_id)
        VALUES ('interval-guard', 'link2', $1, $1, 1, 'sender')`,
        [monthStart]
      )
      for (const status of ['PENDING', 'APPROVED', 'DISPUTED', 'WITHDRAWN']) {
        await pool.query("UPDATE timesheets.client_review_request SET status = $1 WHERE id = 'interval-guard'", [
          status
        ])
        assert.equal((await exports.getClientReviewSettings('provider', 'other')).canChangeCurrentMonth, false)
        await assert.rejects(
          exports.saveClientReviewSettings('provider', 'other', {
            reviewInterval: 'MONTHLY',
            effectiveFrom: 'CURRENT_MONTH'
          }),
          /Timesheets or approval requests exist/
        )
        assert.equal(await exports.getReviewInterval(db, 'link2', today), 'WEEKLY')
      }
      await exports.scheduleClientReviewInterval('provider', 'other', 'MONTHLY')
      assert.equal(await exports.getReviewInterval(db, 'link2', today), 'WEEKLY')
      assert.equal((await exports.getClientReviewSettings('provider', 'other')).scheduledReviewInterval, 'MONTHLY')
      await pool.query("DELETE FROM timesheets.client_review_request WHERE id = 'interval-guard'")
      assert.equal((await exports.getClientReviewSettings('provider', 'other')).canChangeCurrentMonth, true)
      await exports.saveClientReviewSettings('provider', 'other', {
        reviewInterval: 'MONTHLY',
        effectiveFrom: 'CURRENT_MONTH'
      })
      assert.equal(await exports.getReviewInterval(db, 'link2', today), 'MONTHLY')
      assert.equal(await exports.getReviewInterval(db, 'link2', '2020-01-01'), 'WEEKLY')
    })
    await t.test('legacy review creation only includes pre-cutover client slices', async () => {
      await pool.query(
        "INSERT INTO timesheets.client_review (id, submission_id, client_organization_id) VALUES ('old','submission','client'), ('new','second','client')"
      )
      assert.equal((await pool.query('SELECT id FROM timesheets.client_review')).rows.length, 1)
    })
    await t.test(
      'provider correction supports client-only approval and still requires withdrawal of every affected request',
      async () => {
        await pool.query(`
        ALTER TABLE timesheets.workspace_settings ADD COLUMN internal_approvals_enabled boolean DEFAULT false;
        ALTER TABLE timesheets.submission ADD COLUMN weekly_timesheet_id text DEFAULT 'week', ADD COLUMN user_id text DEFAULT 'person', ADD COLUMN period_starts_on date DEFAULT '2020-01-01', ADD COLUMN period_ends_on date DEFAULT '2020-01-05', ADD COLUMN submitted_at timestamp, ADD COLUMN reviewed_at timestamp, ADD COLUMN reviewed_by_id text, ADD COLUMN rejection_comment text, ADD COLUMN version integer DEFAULT 1, ADD COLUMN created_at timestamp DEFAULT now(), ADD COLUMN updated_at timestamp DEFAULT now();
        CREATE TABLE timesheets.internal_approver_assignment (id text, organization_id text, submitter_user_id text, approver_user_id text);
        CREATE TABLE timesheets.approval_history (id text, weekly_timesheet_id text, submission_id text, action text, actor_user_id text, comment text, created_at timestamp DEFAULT now());
        ALTER TABLE timesheets.client_review ADD COLUMN reviewer_user_id text, ADD COLUMN reviewed_at timestamp, ADD COLUMN version integer DEFAULT 1, ADD COLUMN updated_at timestamp DEFAULT now();
      `)
        const repository = {} as typeof import('../server/utils/timesheet-repository')
        runInNewContext(
          ts.transpileModule(
            readFileSync(new URL('../server/utils/timesheet-repository.ts', import.meta.url), 'utf8'),
            { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
          ).outputText,
          {
            exports: repository,
            createError: (input: { message: string }) => Object.assign(new Error(input.message), input),
            require: (id: string) => {
              if (id.endsWith('/server/portal')) {
                return { db }
              }
              if (id === './client-review-requests') {
                return exports
              }
              if (id === './timesheet-email') {
                return { notifyTimesheetEvent: async () => {} }
              }
              if (id.endsWith('/business-hooks')) {
                return {
                  assertTimeEntriesReopenable: async (_org: string, ids: string[]) => {
                    if (ids.some((id) => invoiced.has(id))) {
                      throw new Error('Invoiced timesheets cannot be reopened')
                    }
                  }
                }
              }
              if (id.endsWith('/clients/server/utils/client-repository')) {
                return {}
              }
              if (id === '../../shared/timer-rounding') {
                return require('../shared/timer-rounding')
              }
              if (id === './timesheet-validation') {
                return require('../server/utils/timesheet-validation')
              }
              return require(id)
            }
          }
        )
        await assert.rejects(repository.reviewSubmission('provider', 'sender', 'second', 'REOPEN'), /disabled/)
        await assert.rejects(
          repository.reviewSubmission('provider', 'sender', 'second', 'REOPEN', null, true),
          /Withdraw affected/
        )
        const requests = await exports.listReviewRequests('provider', 'sender', false, true)
        for (const request of requests.filter((r) => r.status !== 'WITHDRAWN')) {
          if (request.entries.some((e) => invoiced.has(e.id))) {
            continue
          }
          await exports.actOnReviewRequest('provider', 'sender', true, request.id, request.version, 'WITHDRAW')
        }
        // The original approved request also covers this submission; it must be withdrawn too.
        await assert.rejects(
          repository.reviewSubmission('provider', 'sender', 'second', 'REOPEN', null, true),
          /Withdraw affected/
        )
        invoiced.clear()
        const original = requests.find((r) => r.id === requestId)!
        await exports.actOnReviewRequest('provider', 'sender', true, original.id, original.version, 'WITHDRAW')
        await repository.reviewSubmission('provider', 'sender', 'second', 'REOPEN', null, true)
        assert.equal(
          (await pool.query("select status from timesheets.submission where id = 'second'")).rows[0].status,
          'DRAFT'
        )
        assert.equal(
          (await pool.query("select action from timesheets.approval_history where submission_id = 'second'")).rows[0]
            .action,
          'REOPENED'
        )
      }
    )
    await t.test('one corrected request can replace both an original request and its supplement', async () => {
      await pool.query("UPDATE timesheets.submission SET status = 'APPROVED' WHERE id = 'second'")
      const replacement = await send()
      const requests = await exports.listReviewRequests('provider', 'sender', false, true)
      assert.equal(requests.find((r) => r.id === replacement.id)!.replacesIds.length, 2)
      assert.equal(requests.find((r) => r.id === replacement.id)!.entries.length, 4)
    })
    await t.test('clients without required approval show automatic decisions instead of hours to send', async () => {
      await pool.query("UPDATE timesheets.workspace_client SET access_mode = 'VIEW' WHERE id = 'link2'")
      await pool.query(`INSERT INTO timesheets.time_entry
        (id, organization_id, client_organization_id, submission_id, user_id, project_id, activity_type_id, entry_date, duration_minutes, billable_snapshot, hourly_rate_minor_snapshot, currency_snapshot)
        VALUES ('no-review-approved', 'provider', 'other', 'submission', 'person', 'project', 'activity', '2020-02-03', 60, true, 10000, 'EUR'),
          ('no-review-draft', 'provider', 'other', null, 'person', 'project', 'activity', '2020-02-04', 30, true, 10000, 'EUR')`)
      try {
        const automatic = (await exports.listSubmissionReviewRequests('provider')).find(
          (request) => request.workspaceClientId === 'link2' && request.startsOn === '2020-02-03'
        )!
        assert.equal(automatic.status, 'AUTO_APPROVED')
        assert.equal(automatic.entries.length, 1)
        assert.equal(automatic.entries[0]!.minutes, 60)
        assert.equal(automatic.clientAvatar, null)
        const periods = (await exports.listReviewPeriods('provider', '2020-02')).filter(
          (period) => period.workspaceClientId === 'link2'
        )
        assert.equal(
          periods.reduce((sum, period) => sum + period.totalMinutes, 0),
          0
        )
        assert.ok(periods.every((period) => !period.canSend))
        await pool.query("UPDATE timesheets.workspace_client SET access_mode = 'DISABLED' WHERE id = 'link2'")
        assert.ok(
          (await exports.listSubmissionReviewRequests('provider')).some(
            (request) => request.id === automatic.id && request.status === 'AUTO_APPROVED'
          )
        )
        await pool.query("UPDATE timesheets.workspace_client SET access_mode = 'REVIEW' WHERE id = 'link2'")
        assert.ok(
          !(await exports.listSubmissionReviewRequests('provider')).some((request) => request.id === automatic.id)
        )
        const reviewPeriods = (await exports.listReviewPeriods('provider', '2020-02')).filter(
          (period) => period.workspaceClientId === 'link2'
        )
        assert.equal(
          reviewPeriods.reduce((sum, period) => sum + period.totalMinutes, 0),
          60
        )
        // An already sent request keeps its status if review access is later disabled.
        await pool.query("UPDATE timesheets.workspace_client SET access_mode = 'VIEW' WHERE id = 'link'")
        assert.ok(
          !(await exports.listSubmissionReviewRequests('provider')).some((request) =>
            request.entries.some((entry) => entry.id === 'entry')
          )
        )
      } finally {
        await pool.query("DELETE FROM timesheets.time_entry WHERE id IN ('no-review-approved', 'no-review-draft')")
        await pool.query("UPDATE timesheets.workspace_client SET access_mode = 'REVIEW' WHERE id IN ('link', 'link2')")
      }
    })
    await t.test('earlier monthly decisions remain visible without drafts or duplicate approved time', async () => {
      await pool.query(
        "INSERT INTO timesheets.submission (id, status, organization_id) VALUES ('earlier-submission', 'APPROVED', 'provider')"
      )
      await pool.query(`INSERT INTO timesheets.time_entry
        (id, organization_id, client_organization_id, submission_id, user_id, project_id, activity_type_id, entry_date, duration_minutes, billable_snapshot, hourly_rate_minor_snapshot, currency_snapshot)
        VALUES ('august', 'provider', 'client', 'earlier-submission', 'person', 'project', 'activity', '2019-08-31', 60, true, 10000, 'EUR'),
          ('september', 'provider', 'client', 'earlier-submission', 'person', 'project', 'activity', '2019-09-01', 90, true, 10000, 'EUR'),
          ('unsubmitted-earlier', 'provider', 'client', null, 'person', 'project', 'activity', '2019-09-02', 30, true, 10000, 'EUR')`)
      await pool.query(`INSERT INTO timesheets.client_review (id, submission_id, client_organization_id, status)
        VALUES ('earlier-review', 'earlier-submission', 'client', 'APPROVED')`)
      const earlier = (await exports.listSubmissionReviewRequests('provider')).filter(
        (request) => request.legacySubmissionId === 'earlier-submission'
      )
      assert.equal(earlier.length, 2)
      assert.ok(earlier.every((request) => request.clientAvatar === 'client-avatar.png'))
      assert.ok(earlier.every((request) => request.supplierAvatar === 'supplier-logo.png'))
      assert.equal(
        earlier
          .find((request) => request.startsOn === '2019-08-31')!
          .entries.reduce((sum, entry) => sum + entry.minutes, 0),
        60
      )
      assert.equal(
        earlier
          .find((request) => request.startsOn === '2019-09-01')!
          .entries.reduce((sum, entry) => sum + entry.minutes, 0),
        90
      )
      assert.ok(earlier.every((request) => request.status === 'APPROVED'))
      assert.equal((await exports.listSubmissionReviewRequests('outsider')).length, 0)
      const periods = await exports.listReviewPeriods('provider', '2019-09')
      assert.equal(
        periods.reduce((sum, period) => sum + period.totalMinutes, 0),
        0
      )
      assert.equal(
        periods.reduce((sum, period) => sum + period.outstandingCount, 0),
        0
      )
      assert.ok(periods.every((period) => !period.canSend))
    })
    await t.test(
      'arbitrary starting months reject all later time and replace only unused future settings',
      async () => {
        await pool.query(`INSERT INTO timesheets.time_entry
        (id, organization_id, client_organization_id, submission_id, user_id, project_id, activity_type_id, entry_date, duration_minutes, billable_snapshot, hourly_rate_minor_snapshot, currency_snapshot)
        VALUES ('schedule-boundary', 'provider', 'other', null, 'person', 'project', 'activity', '2090-04-30', 60, true, 10000, 'EUR')`)
        const previous = await exports.getReviewInterval(db, 'link2', '2090-04-01')
        try {
          assert.equal((await exports.getClientReviewSettings('provider', 'other')).earliestStartingMonth, '2090-05')
          for (const startingMonth of ['2089-01', '2090-04']) {
            await assert.rejects(
              exports.saveClientReviewSettings('provider', 'other', {
                startingMonth,
                reviewInterval: 'TWO_WEEKLY'
              }),
              /Timesheets or approval requests exist/
            )
          }
          await pool.query(`INSERT INTO timesheets.client_review_schedule (workspace_client_id, effective_on, interval)
          VALUES ('link2', '2091-01-01', 'MONTHLY')`)
          await exports.saveClientReviewSettings('provider', 'other', {
            startingMonth: '2090-05',
            reviewInterval: 'TWO_WEEKLY'
          })
          assert.equal(await exports.getReviewInterval(db, 'link2', '2090-04-01'), previous)
          assert.equal(await exports.getReviewInterval(db, 'link2', '2090-05-01'), 'TWO_WEEKLY')
          assert.equal(await exports.getReviewInterval(db, 'link2', '2091-01-01'), 'TWO_WEEKLY')
          await assert.rejects(
            exports.saveClientReviewSettings('provider', 'other', {
              startingMonth: '2090-13',
              reviewInterval: 'MONTHLY'
            }),
            /Invalid starting month/
          )
          // Another client's future time does not block this client's empty months.
          await exports.saveClientReviewSettings('provider', 'client', {
            startingMonth: '2089-01',
            reviewInterval: 'WEEKLY'
          })
          await pool.query(`INSERT INTO timesheets.client_review_request
          (id, workspace_client_id, starts_on, ends_on, revision, sent_by_id)
          VALUES ('schedule-future-request', 'link2', '2092-02-01', '2092-02-29', 1, 'sender')`)
          assert.equal((await exports.getClientReviewSettings('provider', 'other')).earliestStartingMonth, '2092-03')
          await assert.rejects(
            exports.saveClientReviewSettings('provider', 'other', {
              startingMonth: '2091-12',
              reviewInterval: 'MONTHLY'
            }),
            /Timesheets or approval requests exist/
          )
          await exports.saveClientReviewSettings('provider', 'other', {
            startingMonth: '2092-03',
            reviewInterval: 'MONTHLY'
          })
          assert.equal(await exports.getReviewInterval(db, 'link2', '2092-03-01'), 'MONTHLY')
        } finally {
          await pool.query("DELETE FROM timesheets.client_review_request WHERE id = 'schedule-future-request'")
          await pool.query("DELETE FROM timesheets.time_entry WHERE id = 'schedule-boundary'")
          await pool.query("DELETE FROM timesheets.client_review_schedule WHERE effective_on >= '2089-01-01'")
        }
      }
    )
    await t.test(
      'empty periods require active tracking and use each client’s interval for the selected month',
      async () => {
        await pool.query(`INSERT INTO timesheets.client_review_schedule (workspace_client_id, effective_on, interval)
        VALUES ('link', '2096-01-01', 'WEEKLY'), ('link', '2098-01-01', 'MONTHLY'), ('link2', '2098-01-01', 'WEEKLY')`)
        try {
          const periods = await exports.listReviewPeriods('provider', '2099-02')
          const monthly = periods.filter((period) => period.workspaceClientId === 'link')
          const weekly = periods.filter((period) => period.workspaceClientId === 'link2')
          assert.deepEqual(
            Array.from(monthly, ({ startsOn, endsOn, interval }) => ({ startsOn, endsOn, interval })),
            [{ startsOn: '2099-02-01', endsOn: '2099-02-28', interval: 'MONTHLY' }]
          )
          assert.ok(weekly.length > 1)
          assert.ok(weekly.every((period) => period.interval === 'WEEKLY'))
          assert.equal(weekly[0]!.startsOn, '2099-02-01')
          assert.equal(weekly.at(-1)!.endsOn, '2099-02-28')
          assert.ok(
            periods.every((period) => period.timeTrackingEnabled && !period.availableCount && !period.outstandingCount)
          )
          // A future interval must not change how earlier months are grouped.
          assert.ok(
            (await exports.listReviewPeriods('provider', '2097-02'))
              .filter((period) => period.workspaceClientId === 'link')
              .every((period) => period.interval === 'WEEKLY')
          )
          await pool.query("UPDATE clients.client_module SET enabled = false WHERE organization_id = 'client'")
          assert.ok(
            !(await exports.listReviewPeriods('provider', '2099-02')).some(
              (period) => period.workspaceClientId === 'link'
            )
          )
          // Recorded time still supplies this client to the monthly filter.
          const recorded = (await exports.listReviewPeriods('provider', '2020-01')).filter(
            (period) => period.workspaceClientId === 'link'
          )
          assert.ok(recorded.length > 0)
          assert.ok(recorded.every((period) => !period.timeTrackingEnabled))
          await pool.query("UPDATE clients.client_profile SET archived_at = now() WHERE organization_id = 'other'")
          assert.equal((await exports.listReviewPeriods('provider', '2099-02')).length, 0)
        } finally {
          await pool.query("UPDATE clients.client_module SET enabled = true WHERE organization_id = 'client'")
          await pool.query("UPDATE clients.client_profile SET archived_at = null WHERE organization_id = 'other'")
          await pool.query(
            "DELETE FROM timesheets.client_review_schedule WHERE effective_on IN ('2096-01-01', '2098-01-01')"
          )
        }
      }
    )
    await t.test('full module migrations apply on an empty database', async () => {
      const migrationName = `${name}_migrations_demo`
      await admin.query(`CREATE DATABASE ${migrationName}`)
      const migrationUrl = new URL(url)
      migrationUrl.pathname = `/${migrationName}`
      const migrationPool = new Pool({ connectionString: migrationUrl.href })
      try {
        for (const module of ['core', 'clients', 'timesheets', 'invoices', 'invoice-timesheets']) {
          const directory = new URL(`../../${module}/migrations/`, import.meta.url)
          for (const file of readdirSync(directory)
            .filter((name) => name.endsWith('.sql'))
            .sort()) {
            await migrationPool.query('BEGIN')
            if (module === 'timesheets') {
              await migrationPool.query('SET LOCAL search_path TO timesheets, public')
            }
            await migrationPool.query(readFileSync(new URL(file, directory), 'utf8'))
            await migrationPool.query('COMMIT')
          }
        }
        assert.equal(
          (await migrationPool.query('select count(*) from timesheets.client_review_rollout')).rows[0].count,
          '1'
        )
        const demo = {} as typeof import('../../../apps/demo-layer/server/utils/demo-reset')
        runInNewContext(
          ts.transpileModule(
            readFileSync(new URL('../../../apps/demo-layer/server/utils/demo-reset.ts', import.meta.url), 'utf8'),
            { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
          ).outputText,
          {
            exports: demo,
            process: { env: { DATABASE_URL: migrationUrl.href } },
            require: (id: string) =>
              id === './demo-data' ? { demoDay: () => '2026-10-14', seedDemoData: async () => {} } : require(id)
          }
        )
        try {
          const before = (await migrationPool.query('select starts_on::text from timesheets.client_review_rollout'))
            .rows[0].starts_on
          await demo.resetDemoIfDue()
          assert.equal(
            (await migrationPool.query('select starts_on::text from timesheets.client_review_rollout')).rows[0]
              .starts_on,
            before
          )
        } finally {
          await demo.demoPool.end()
        }
      } finally {
        await migrationPool.end()
        await admin.query(`DROP DATABASE ${migrationName} WITH (FORCE)`)
      }
    })
    await db.execute(sql`select 1`)
  } finally {
    await pool.end()
    await admin.query(`DROP DATABASE ${name} WITH (FORCE)`)
    await admin.end()
  }
})
