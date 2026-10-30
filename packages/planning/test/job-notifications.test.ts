import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const source = ts.transpileModule(readFileSync(new URL('../server/utils/jobs.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText

function harness(kind: string) {
  const emails: Array<Record<string, unknown>> = [],
    queries: string[] = []
  let released = false
  const client = {
    query: async () => ({ rows: [{ locked: true }] }),
    release: () => {
      released = true
    }
  }
  const exports = {} as typeof import('../server/utils/jobs')
  runInNewContext(source, {
    exports,
    require: (id: string) => {
      if (id.endsWith('/utils/db')) {
        return { pool: { connect: async () => client } }
      }
      if (id.endsWith('/utils/database')) {
        return {
          rows: async (sql: string) => {
            queries.push(sql)
            if (sql.startsWith('WITH scoped')) {
              return [{ id: 'queued-notice', kind, payload: { userId: 'provider' }, attempts: 0 }]
            }
            if (sql.startsWith('SELECT completed_at')) {
              return [{ completed_at: null }]
            }
            if (sql.startsWith('SELECT email,first_name,name')) {
              return [{ email: 'provider@example.test', first_name: 'Provider', name: 'Provider' }]
            }
            return []
          }
        }
      }
      if (id.endsWith('/utils/portal-email')) {
        return {
          sendPortalEmail: async (email: Record<string, unknown>) => {
            emails.push(email)
          }
        }
      }
      if (id.endsWith('/utils/access')) {
        return { baseUrl: () => 'http://localhost:3059' }
      }
      if (id.endsWith('/shared/email-recipient')) {
        return { emailRecipientName: () => 'Provider' }
      }
      if (id === '../../shared/emails') {
        return { appointmentEmail: { id: 'appointment' } }
      }
      if (id.startsWith('.') || id.startsWith('@nuxt-customer-portal/')) {
        return {}
      }
      return require(id)
    }
  })
  return { runJobs: exports.runJobs, emails, queries, released: () => released }
}

test('previously queued calendar synchronization notices complete without sending email', async () => {
  const fixture = harness('mirror-notice')
  const result = await fixture.runJobs()
  assert.equal(result.completed, 1)
  assert.equal(result.failed, 0)
  assert.equal(fixture.emails.length, 0)
  assert.ok(fixture.queries.some((sql) => sql.startsWith('UPDATE planning.job SET completed_at=now()')))
  assert.equal(
    fixture.queries.some((sql) => sql.startsWith('SELECT email,first_name,name')),
    false
  )
  assert.equal(fixture.released(), true)
})

test('genuine calendar conflicts still email the provider', async () => {
  const fixture = harness('conflict')
  const result = await fixture.runJobs()
  assert.equal(result.completed, 1)
  assert.equal(result.failed, 0)
  assert.equal(fixture.emails.length, 1)
  assert.equal(fixture.emails[0]!.to, 'provider@example.test')
  assert.equal((fixture.emails[0]!.values as Record<string, unknown>).product, 'Calendar conflict')
  assert.equal(fixture.released(), true)
})
