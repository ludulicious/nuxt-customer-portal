import test from 'node:test'
import assert from 'node:assert/strict'
import { browserCountry, countryCodes } from '../shared/countries'

test('browser country uses explicit regions and ignores language-only preferences', () => {
  assert.equal(browserCountry(['nl-NL', 'en-US']), 'NL')
  assert.equal(browserCountry(['en', 'fr-FR']), 'FR')
  assert.equal(browserCountry(['en']), undefined)
  assert.equal(browserCountry(['invalid_tag', 'en-GB']), 'GB')
  assert.equal(countryCodes.length, 249)
  assert.equal(new Set(countryCodes).size, 249)
})
