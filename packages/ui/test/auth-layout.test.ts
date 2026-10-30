import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { resolveAuthBackgrounds } from '../app/utils/auth-background'

test('authentication pages omit the home back button while retaining their content and bootstrap notice', async () => {
  const source = await readFile(new URL('../app/layouts/auth.vue', import.meta.url), 'utf8')

  assert.doesNotMatch(source, /auth-back-button|i-lucide-chevron-left|to="\/"/)
  assert.match(source, /<slot\s*\/>/)
  assert.match(source, /route\.path === '\/signup' && bootstrap && !bootstrap\.adminExists/)
})

test('authentication backgrounds select each viewport image and fall back to the only uploaded image', () => {
  assert.deepEqual(resolveAuthBackgrounds(), { desktop: '', mobile: '' })
  assert.deepEqual(resolveAuthBackgrounds(null), { desktop: '', mobile: '' })
  assert.deepEqual(resolveAuthBackgrounds({}), { desktop: '', mobile: '' })
  assert.deepEqual(resolveAuthBackgrounds({ authBackgroundDesktop: 'desktop-image' }), {
    desktop: 'desktop-image',
    mobile: 'desktop-image'
  })
  assert.deepEqual(resolveAuthBackgrounds({ authBackgroundMobile: 'mobile-image' }), {
    desktop: 'mobile-image',
    mobile: 'mobile-image'
  })
  assert.deepEqual(
    resolveAuthBackgrounds({ authBackgroundDesktop: 'desktop-image', authBackgroundMobile: 'mobile-image' }),
    { desktop: 'desktop-image', mobile: 'mobile-image' }
  )
})

test('authentication backgrounds are responsive and decorative without clipping the form on short screens', async () => {
  const source = await readFile(new URL('../app/layouts/auth.vue', import.meta.url), 'utf8')

  assert.match(source, /<picture v-if="backgrounds\.desktop"[^>]*aria-hidden="true"/)
  assert.match(source, /<source media="\(max-width: 1023px\)" :srcset="backgrounds\.mobile"/)
  assert.match(source, /<img :src="backgrounds\.desktop" alt="" fetchpriority="high"/)
  assert.match(source, /min-height: 100dvh/)
  assert.match(source, /\.auth-shell--illustrated \.auth-card\s*\{\s*background: var\(--ui-bg-elevated\)/)
  assert.doesNotMatch(source, /class="[^"]*\bh-screen\b/)
})

test('authentication forms sit near the top on mobile while retaining desktop vertical centering', async () => {
  const source = await readFile(new URL('../app/layouts/auth.vue', import.meta.url), 'utf8')

  assert.match(source, /\.auth-shell\s*\{[^}]*align-items: center;/)
  assert.match(source, /@media \(max-width: 1023px\)\s*\{\s*\.auth-shell\s*\{\s*align-items: flex-start;/)
  assert.match(source, /padding: max\(1\.5rem, env\(safe-area-inset-top\)\)/)
})
