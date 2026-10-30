import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { accountOrganizationsFeature } from '../../organizations/shared/feature'

test('main navigation omits redundant organization and account settings links', () => {
  const navigation = accountOrganizationsFeature.navigation ?? []

  assert.ok(!navigation.some((item) => item.to === '/my-organizations' || item.to === '/settings'))
})

test('desktop and inline user menus use the translated Account Settings label', async () => {
  const source = await readFile(new URL('../app/components/AppUserMenu.vue', import.meta.url), 'utf8')

  assert.match(source, /label: t\('menu.settings.title'\),\s+icon: 'i-lucide-cog',\s+to: '\/settings'/)
  assert.match(source, /:label="t\('menu.settings.title'\)"\s+icon="i-lucide-cog"\s+to="\/settings"/)

  for (const [locale, expected] of [
    ['en', 'Account Settings'],
    ['nl', 'Accountinstellingen']
  ]) {
    const messages = JSON.parse(
      await readFile(new URL(`../../core/i18n/locales/${locale}.json`, import.meta.url), 'utf8')
    )
    assert.equal(messages.menu.settings.title, expected)
  }
})

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
