import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const source = ts.transpileModule(readFileSync(new URL('../server/utils/booking.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText

test('availability refresh increments revisions and queues both affected providers in the booking transaction', async () => {
  const inserted: unknown[][] = []
  const transaction = {
    query: async (_sql: string, values: unknown[]) => {
      inserted.push(values)
    }
  }
  const exports = {} as typeof import('../server/utils/booking')
  runInNewContext(source, {
    exports,
    require: (id: string) => {
      if (id.endsWith('/utils/database')) {
        return {
          rows: async (sql: string, values: unknown[], tx: unknown) => {
            assert.equal(tx, transaction)
            assert.match(sql, /revision=revision\+1/)
            assert.match(sql, /AND NOT deleted RETURNING id,revision/)
            assert.equal(values[0], 'store')
            assert.deepEqual(Array.from(values[1] as string[]), ['previous-provider', 'new-provider'])
            return [
              { id: 'previous-window', revision: 4 },
              { id: 'new-window', revision: 8 }
            ]
          }
        }
      }
      if (id.startsWith('.') || id.startsWith('@nuxt-customer-portal/')) {
        return {}
      }
      return require(id)
    }
  })
  await exports.refreshAvailability(transaction as never, 'store', [
    'previous-provider',
    'new-provider',
    'new-provider'
  ])
  assert.deepEqual(
    inserted.map((values) => [values[0], values[1]]),
    [
      ['availability:previous-window:4', 'availability'],
      ['availability:new-window:8', 'availability']
    ]
  )
})
