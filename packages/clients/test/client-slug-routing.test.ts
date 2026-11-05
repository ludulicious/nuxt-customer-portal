import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { computed, ref } from 'vue'
import ts from 'typescript'

const source = readFileSync(new URL('../server/api/clients/resolve/[slug].get.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText

function resolver(options: { slugId?: string; legacyId?: string; denied?: boolean; unauthenticated?: boolean } = {}) {
  const calls: string[] = []
  const exports = {} as { default: (event: object) => Promise<{ id: string; slug: string }> }
  runInNewContext(code, {
    exports,
    defineEventHandler: (handler: unknown) => handler,
    getRouterParam: () => 'client-reference',
    createError: (error: object) => error,
    require: (id: string) => {
      if (id.endsWith('/portal')) {
        return {
          requireActiveOrganizationRole: async () => {
            calls.push('authenticate')
            if (options.unauthenticated) {
              throw { statusCode: 401 }
            }
          }
        }
      }
      if (id.endsWith('/client-access')) {
        return {
          requireClientProfileManager: async (_event: object, clientId: string) => {
            calls.push(`authorize:${clientId}`)
            if (options.denied) {
              throw { statusCode: 403 }
            }
          }
        }
      }
      if (id.endsWith('/client-repository')) {
        return {
          getClientBySlug: async (slug: string) => {
            calls.push(`slug:${slug}`)
            return options.slugId ? { id: options.slugId, slug } : null
          },
          getClient: async (id: string) => {
            calls.push(`legacy:${id}`)
            return options.legacyId ? { id: options.legacyId, slug: 'current-slug' } : null
          }
        }
      }
      throw new Error(`Unexpected import: ${id}`)
    }
  })
  return { run: () => exports.default({}), calls }
}

test('slug lookup authenticates first and authorizes the resolved stable client ID', async () => {
  const handler = resolver({ slugId: 'stable-id' })
  assert.equal((await handler.run()).id, 'stable-id')
  assert.deepEqual(handler.calls, ['authenticate', 'slug:client-reference', 'authorize:stable-id'])
})

test('old ID detail links resolve to their current slug', async () => {
  const handler = resolver({ legacyId: 'stable-id' })
  assert.equal((await handler.run()).slug, 'current-slug')
  assert.deepEqual(handler.calls, [
    'authenticate',
    'slug:client-reference',
    'legacy:client-reference',
    'authorize:stable-id'
  ])
})

test('missing, unauthenticated and unauthorized slug lookups do not return client profiles', async () => {
  await assert.rejects(resolver().run, { statusCode: 404 })
  await assert.rejects(resolver({ slugId: 'foreign-id', denied: true }).run, { statusCode: 403 })
  const anonymous = resolver({ slugId: 'stable-id', unauthenticated: true })
  await assert.rejects(anonymous.run, { statusCode: 401 })
  assert.deepEqual(anonymous.calls, ['authenticate'])
})

const repository = readFileSync(new URL('../server/utils/client-repository.ts', import.meta.url), 'utf8')
const updateSource = repository.split('export const updateClient = ')[1]!.split('export const setClientArchived')[0]!
const updateCode = ts.transpileModule(`(${updateSource.trim()})`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 }
}).outputText

function updateHarness(existingSlugId?: string) {
  const rows = [[{ id: 'client-id' }], [{ clientType: 'organization' }], existingSlugId ? [{ id: existingSlugId }] : []]
  const writes: { table: string; values: Record<string, unknown> }[] = []
  const tx = {
    select: () => {
      const result = rows.shift()!
      const query = {
        from: () => query,
        where: () => query,
        limit: async () => result,
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
      }
      return query
    },
    update: (table: string) => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          writes.push({ table, values })
        }
      })
    })
  }
  const run = runInNewContext(updateCode, {
    db: { transaction: (callback: (transaction: typeof tx) => unknown) => callback(tx) },
    organization: 'organization',
    clientProfile: 'profile',
    eq: (...values: unknown[]) => values,
    and: (...values: unknown[]) => values,
    createError: (error: object) => error
  }) as (id: string, input: { slug: string }) => Promise<unknown>
  return { run: () => run('client-id', { slug: 'client-slug' }), writes }
}

test('repository rejects conflicting slugs before writing any client changes', async () => {
  const handler = updateHarness('another-client-id')
  await assert.rejects(
    handler.run,
    (error: { statusCode?: number; data?: { field?: string } }) =>
      error.statusCode === 409 && error.data?.field === 'slug'
  )
  assert.equal(handler.writes.length, 0)
})

test('repository accepts unique slugs and the clients own unchanged slug', async () => {
  for (const existingSlugId of [undefined, 'client-id']) {
    const handler = updateHarness(existingSlugId)
    await handler.run()
    assert.equal(handler.writes[0]?.table, 'organization')
    assert.equal(handler.writes[0]?.values.slug, 'client-slug')
  }
})

test('detail navigation uses canonical slugs and preserves return state after edits', async () => {
  const page = readFileSync(new URL('../app/pages/clients/[slug].vue', import.meta.url), 'utf8')
  const script = page
    .split('<script setup lang="ts">')[1]!
    .split('</script>')[0]!
    .replace(/^import .*\n/gm, '')
  const pageCode = ts.transpileModule(`(async () => { ${script}; return { handleUpdated, client } })()`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 }
  }).outputText
  const query = { returnTo: '/clients?search=Example&page=2&scroll=140', edit: 'true' }
  const route = { params: { slug: 'internal-id' }, query, hash: '#profile' }
  const navigations: { path: string; query: typeof query; hash: string }[] = []
  const result = await runInNewContext(pageCode, {
    computed,
    ref,
    useRoute: () => route,
    useI18n: () => ({ t: (key: string) => key }),
    useClients: () => ({ resolve: async () => ({ id: 'internal-id', slug: 'old-slug' }) }),
    useAsyncData: async (_key: unknown, load: () => Promise<unknown>) => ({ data: ref(await load()) }),
    useSeoMeta: () => {},
    navigateTo: async (target: (typeof navigations)[number]) => {
      navigations.push(target)
    }
  })
  assert.equal(navigations[0]?.path, '/clients/old-slug')
  assert.equal(navigations[0]?.query, query)
  await result.handleUpdated({ id: 'internal-id', slug: 'new-slug', name: 'Edited Client' })
  assert.equal(result.client.value.slug, 'new-slug')
  assert.equal(navigations[1]?.path, '/clients/new-slug')
  assert.equal(navigations[1]?.query.returnTo, query.returnTo)
  assert.equal(navigations[1]?.query.edit, undefined)
  assert.equal(navigations[1]?.hash, '#profile')
})
