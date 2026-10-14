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
      CREATE TABLE public.organization (id text PRIMARY KEY, name text NOT NULL);
      CREATE TABLE public."user" (id text PRIMARY KEY, name text NOT NULL, email text NOT NULL);
      CREATE TABLE public.member (id text PRIMARY KEY, organization_id text NOT NULL, user_id text NOT NULL, role text NOT NULL);
      CREATE SCHEMA timesheets;
      CREATE TABLE timesheets.workspace_settings (organization_id text PRIMARY KEY, timezone text, week_starts_on integer);
      CREATE TABLE timesheets.workspace_client (id text PRIMARY KEY, workspace_organization_id text NOT NULL, client_organization_id text NOT NULL, access_mode text NOT NULL);
      CREATE TABLE timesheets.workspace_client_reviewer (workspace_client_id text, user_id text);
      CREATE TABLE timesheets.submission (id text PRIMARY KEY, status text NOT NULL);
      CREATE TABLE timesheets.project (id text PRIMARY KEY, name text NOT NULL);
      CREATE TABLE timesheets.activity_type (id text PRIMARY KEY, name text NOT NULL);
      CREATE TABLE timesheets.time_entry (id text PRIMARY KEY, organization_id text NOT NULL, client_organization_id text NOT NULL, submission_id text, user_id text, project_id text, activity_type_id text, entry_date date, duration_minutes integer, note text, billable_snapshot boolean, hourly_rate_minor_snapshot integer, currency_snapshot text, timer_started_at timestamp);
      CREATE TABLE timesheets.client_review (id text PRIMARY KEY, submission_id text, client_organization_id text);
    `)
    await pool.query(readFileSync(new URL('../migrations/0007_client_review_requests.sql', import.meta.url), 'utf8'))
    await pool.query(`
      UPDATE timesheets.client_review_rollout SET starts_on = '2020-01-01';
      INSERT INTO public.organization VALUES ('provider','Provider'), ('client','Client'), ('other','Other'), ('outsider','Outsider');
      INSERT INTO public."user" VALUES ('sender','Sender','sender@example.com'), ('person','Person','person@example.com'), ('person2','Second','second@example.com'), ('reviewer','Reviewer','reviewer@example.com'), ('stranger','Stranger','stranger@example.com');
      INSERT INTO public.member VALUES ('m1','client','reviewer','member');
      INSERT INTO timesheets.workspace_settings VALUES ('provider','Europe/Amsterdam',1);
      INSERT INTO timesheets.workspace_client VALUES ('link','provider','client','REVIEW'), ('link2','provider','other','REVIEW');
      INSERT INTO timesheets.workspace_client_reviewer VALUES ('link','reviewer');
      INSERT INTO timesheets.project VALUES ('project','Project');
      INSERT INTO timesheets.activity_type VALUES ('activity','Activity');
      INSERT INTO timesheets.submission VALUES ('submission','APPROVED'), ('second','APPROVED'), ('draft','DRAFT');
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
      ALTER TABLE timesheets.client_review ADD COLUMN status text DEFAULT 'PENDING';
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
        const future = (await exports.listReviewPeriods('provider', '2099-01'))[0]!
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
        ALTER TABLE timesheets.client_review ADD COLUMN reviewer_user_id text, ADD COLUMN comment text, ADD COLUMN reviewed_at timestamp, ADD COLUMN version integer DEFAULT 1, ADD COLUMN updated_at timestamp DEFAULT now();
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
