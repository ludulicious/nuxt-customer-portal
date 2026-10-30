import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { runInNewContext } from 'node:vm'

test('logout clears the session and user data before redirecting directly to login', async () => {
  const source = await readFile(new URL('../app/components/AppUserMenu.vue', import.meta.url), 'utf8')
  const handler = source.match(/const signOut = async \(\) => \{([\s\S]*?)\n\}/)?.[1]
  assert.ok(handler)
  const calls: string[] = []
  const signOut = runInNewContext(`async () => {${handler}}`, {
    authClient: {
      signOut: async () => {
        calls.push('sign-out')
      }
    },
    userStore: {
      clearUserData: () => {
        calls.push('clear-user')
      }
    },
    emit: (event: string) => {
      calls.push(`emit:${event}`)
    },
    navigateTo: async (path: string, options: { replace?: boolean }) => {
      assert.equal(path, '/login')
      assert.equal(options.replace, true)
      calls.push('navigate:login')
    }
  })

  await signOut()

  assert.deepEqual(calls, ['sign-out', 'clear-user', 'emit:navigate', 'navigate:login'])
  assert.match(source, /onSelect: signOut/)
  assert.match(source, /@click="signOut"/)
})
