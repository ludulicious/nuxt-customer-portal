import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { computed, reactive, ref, type Ref } from 'vue'
import ts from 'typescript'
import type { OfferArchiveInput } from '../shared/offers'
import type { ProductOffer } from '../shared/types'

const card = readFileSync(new URL('../app/components/ProductsOffersCard.vue', import.meta.url), 'utf8')
const script = card.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)![1]!
const parsed = ts.createSourceFile('offers.ts', script, ts.ScriptTarget.Latest, true)
const declarations = ['showArchived', 'visibleOffers', 'busy', 'error']
const source = ts.transpileModule(
  parsed.statements
    .filter(
      (statement) =>
        (ts.isVariableStatement(statement) &&
          statement.declarationList.declarations.some(
            (declaration) => ts.isIdentifier(declaration.name) && declarations.includes(declaration.name.text)
          )) ||
        (ts.isFunctionDeclaration(statement) && statement.name?.text === 'archive')
    )
    .map((statement) => statement.getText(parsed))
    .join('\n') + '\nexport { showArchived, visibleOffers, busy, error, archive }',
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText

const ended: ProductOffer = {
  id: 'ended',
  startsAt: '2026-10-20T00:00:00Z',
  endsAt: '2026-10-31T23:59:00Z',
  enabled: true,
  archived: false,
  isFree: true,
  prices: []
}

function harness(fail = false) {
  const props = reactive({
    product: { id: 'product', offers: [{ ...ended }, { ...ended, id: 'archived', archived: true }] }
  })
  const calls: Array<{ productId: string; offerId: string; body: OfferArchiveInput }> = []
  const events: string[] = []
  const exports = {} as {
    showArchived: Ref<boolean>
    visibleOffers: Ref<ProductOffer[]>
    busy: Ref<boolean>
    error: Ref<string>
    archive(offer: ProductOffer): Promise<void>
  }
  runInNewContext(source, {
    exports,
    props,
    ref,
    computed,
    t: (key: string) => key,
    emit: (event: string) => events.push(event),
    api: {
      async setOfferArchived(productId: string, offerId: string, body: OfferArchiveInput) {
        if (fail) {
          throw new Error('request failed')
        }
        calls.push({ productId, offerId, body })
      }
    }
  })
  return { ...exports, props, calls, events }
}

test('archived offers are hidden by default and can be included without losing status or prices', () => {
  const state = harness()
  assert.deepEqual(
    state.visibleOffers.value.map((offer) => offer.id),
    ['ended']
  )
  state.showArchived.value = true
  assert.deepEqual(
    state.visibleOffers.value.map((offer) => offer.id),
    ['ended', 'archived']
  )
  state.showArchived.value = false
  state.props.product.offers[0]!.archived = true
  assert.equal(state.visibleOffers.value.length, 0)
  state.props.product.offers[1]!.archived = false
  assert.deepEqual(
    state.visibleOffers.value.map((offer) => offer.id),
    ['archived']
  )
})

test('archive and restore use the composable and refresh only after a successful save', async () => {
  const state = harness()
  const saving = state.archive(state.props.product.offers[0]!)
  assert.equal(state.busy.value, true)
  await saving
  assert.equal(state.calls[0]!.productId, 'product')
  assert.equal(state.calls[0]!.offerId, 'ended')
  assert.equal(state.calls[0]!.body.archived, true)
  await state.archive(state.props.product.offers[1]!)
  assert.equal(state.calls[1]!.body.archived, false)
  assert.deepEqual(state.events, ['saved', 'saved'])
  assert.equal(state.busy.value, false)
  assert.equal(state.error.value, '')
})

test('archive failures keep the list intact and show a localized error', async () => {
  const state = harness(true)
  await state.archive(state.props.product.offers[0]!)
  assert.equal(state.busy.value, false)
  assert.equal(state.error.value, 'products.offers.archiveFailed')
  assert.equal(state.events.length, 0)
  assert.equal(state.props.product.offers[0]!.archived, false)
})

test('archive controls retain ended status, disable busy actions and have English and Dutch labels', () => {
  assert.match(card, /v-model="showArchived"/)
  assert.match(card, /v-for="offer in visibleOffers"/)
  assert.match(card, /offer.archived \|\| canArchiveOffer\(offer, new Date\(now\)\)/)
  assert.match(card, /:disabled="disabled \|\| busy"\s+@click="archive\(offer\)"/)
  assert.match(card, /products\.offers\.\$\{status\(offer\)\}/)
  for (const locale of ['en', 'nl']) {
    const { products } = JSON.parse(readFileSync(new URL(`../i18n/locales/${locale}.json`, import.meta.url), 'utf8'))
    for (const key of ['archive', 'restore', 'archived', 'showArchived', 'archiveHelp', 'archiveFailed']) {
      assert.ok(products.offers[key]?.length, `${locale}: ${key}`)
    }
  }
})
