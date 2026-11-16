import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { nextTick, ref, watch, type WatchStopHandle } from 'vue'
import ts from 'typescript'

const source = ts.transpileModule(readFileSync(new URL('../app/plugins/auth.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText

test('auth initializes once from the reactive request and follows sign-in, updates and sign-out', async () => {
  const initial = { id: 'session', user: { id: 'person', name: 'Person' } }
  const session = ref<typeof initial | null>(initial)
  const received: unknown[] = []
  const stops: WatchStopHandle[] = []
  let requests = 0
  const exports: { default?: { setup(): Promise<void> } } = {}
  runInNewContext(source, {
    exports,
    require: () => ({
      authClient: {
        getSession: () => {
          throw new Error('Duplicate standalone session request')
        },
        useSession: async () => {
          requests++
          return { data: session }
        }
      }
    }),
    defineNuxtPlugin: (value: unknown) => value,
    useUserStore: () => ({
      setSession: async (value: unknown) => {
        received.push(value)
      }
    }),
    useFetch: () => {},
    watch: (...args: Parameters<typeof watch>) => {
      const stop = watch(...args)
      stops.push(stop)
      return stop
    },
    console: {
      log: (message: unknown) => {
        throw new Error(String(message))
      }
    }
  })
  try {
    await exports.default!.setup()
    assert.equal(requests, 1)
    assert.equal(received.length, 1)
    assert.equal((received[0] as typeof initial).user.id, 'person')
    session.value = null
    await nextTick()
    assert.equal(received.at(-1), null)
    session.value = { id: 'next-session', user: { id: 'person', name: 'Updated person' } }
    await nextTick()
    assert.equal((received.at(-1) as typeof initial).user.name, 'Updated person')
    assert.equal(requests, 1)
    assert.equal(received.length, 3)
  } finally {
    stops.forEach((stop) => stop())
  }
})
