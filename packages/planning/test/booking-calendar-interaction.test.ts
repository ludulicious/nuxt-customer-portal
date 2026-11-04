import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const picker = readFileSync(new URL('../app/components/PlanningSlotPicker.vue', import.meta.url), 'utf8')

test('month navigation has explicit accent hover and pressed states without changing button dimensions', () => {
  assert.equal((picker.match(/class="calendar-navigation"/g) || []).length, 2)
  const hover = picker.match(/\.calendar-navigation:not\(:disabled\):hover\s*\{([^}]+)\}/)![1]!
  assert.match(
    hover,
    /background: color-mix\(in srgb, var\(--checkout-accent, var\(--ui-primary\)\) 20%, transparent\)/
  )
  assert.match(hover, /box-shadow: inset 0 0 0 1px/)
  assert.doesNotMatch(hover, /padding|border-radius|height|width/)
  assert.match(picker, /\.calendar-navigation:not\(:disabled\):active\s*\{\s*color: white;/)
})

test('available dates strengthen tint and border on hover without styling disabled dates as interactive', () => {
  const hover = picker.match(/\.calendar-date--available:not\(:disabled\):hover\s*\{([^}]+)\}/)![1]!
  assert.match(hover, /25%, transparent/)
  assert.match(hover, /border-color: var\(--checkout-accent/)
  assert.match(hover, /box-shadow: inset 0 0 0 1px/)
  assert.match(picker, /\.calendar-date--available:not\(:disabled\):active\s*\{\s*color: white;/)
  assert.match(picker, /\.calendar-date--selected:not\(:disabled\):hover\s*\{\s*background: var\(--checkout-accent/)
})
