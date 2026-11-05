import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { canCreditInvoice, copiedInvoiceDates, copyInvoiceLines, invoiceLineAmount } from '../shared/invoice-copy'

const detailSource = readFileSync(new URL('../app/components/InvoicesInvoiceDetail.vue', import.meta.url), 'utf8')
const detailScript = ts.createSourceFile(
  'detail.ts',
  detailSource.slice(detailSource.indexOf('>') + 1, detailSource.indexOf('</script>')),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS
)
const detailCallback = (name: string, context: Record<string, unknown>) => {
  let expression = ''
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(detailScript) === name) {
      expression = node.initializer!.getText(detailScript)
    }
    if (name === 'onMounted' && ts.isCallExpression(node) && node.expression.getText(detailScript) === name) {
      expression = node.arguments[0]!.getText(detailScript)
    }
    ts.forEachChild(node, visit)
  }
  visit(detailScript)
  assert.ok(expression, name)
  return runInNewContext(
    ts.transpileModule(`(${expression})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
    context
  )
}

test('duplicate and credit navigate to the created invoice with edit intent', async () => {
  for (const credit of [false, true]) {
    const calls: string[] = []
    const navigations: unknown[] = []
    const busy = { value: false }
    const confirmation = { value: true }
    const copy = detailCallback('createCopy', {
      props: { invoice: { id: 'original' } },
      busy,
      creditConfirmationOpen: confirmation,
      api: {
        duplicateInvoice: async (id: string) => {
          calls.push(`duplicate:${id}`)
          return { id: 'duplicate' }
        },
        creditInvoice: async (id: string) => {
          calls.push(`credit:${id}`)
          return { id: 'credit' }
        }
      },
      navigateTo: async (target: unknown) => navigations.push(JSON.parse(JSON.stringify(target))),
      toast: { add: () => {} },
      t: (key: string) => key
    })
    await copy(credit)
    const action = credit ? 'credit' : 'duplicate'
    assert.deepEqual(calls, [`${action}:original`])
    assert.deepEqual(navigations, [{ path: `/admin/invoices/${action}`, query: { edit: 'true' } }])
    assert.equal(busy.value, false)
    assert.equal(confirmation.value, false)
  }
})

test('initial edit intent opens only admin drafts through the existing editor initialization', async () => {
  for (const startEditing of [false, true]) {
    for (const client of [false, true]) {
      for (const status of ['DRAFT', 'ISSUED', 'PAID', 'VOID']) {
        let opened = 0
        const mounted = detailCallback('onMounted', {
          props: { startEditing, invoice: { status } },
          isClient: { value: client },
          emit: (event: string) => assert.equal(event, 'editStarted'),
          openEdit: async () => {
            opened++
          }
        })
        await mounted()
        assert.equal(opened, startEditing && !client && status === 'DRAFT' ? 1 : 0)
      }
    }
  }
  const route = readFileSync(new URL('../app/pages/admin/invoices/[id].vue', import.meta.url), 'utf8')
  assert.match(route, /:start-editing="route.query.edit === 'true' && editingStartedFor !== invoice.id"/)
  assert.match(route, /@edit-started="editingStartedFor = invoice.id"/)
  assert.match(route, /:key="invoice.id"/)
})

test('consuming edit intent prevents refreshes from reopening the editor after save or cancel', async () => {
  const props = { startEditing: true, invoice: { status: 'DRAFT' } }
  let opened = 0
  const mounted = detailCallback('onMounted', {
    props,
    isClient: { value: false },
    emit: () => {
      props.startEditing = false
    },
    openEdit: async () => {
      opened++
    }
  })
  await mounted()
  await mounted()
  assert.equal(opened, 1)
})

test('duplicate lines preserve quantities, prices, VAT details and source values', () => {
  const source = [
    {
      description: 'Consulting',
      quantityMilli: 1500,
      unitPriceMinor: 101,
      vatRateBasisPoints: 2100,
      exactTaxMinor: 33,
      taxDetails: { source: 'stripe' }
    }
  ]
  const result = copyInvoiceLines(source, false)
  assert.deepEqual(result, source)
  assert.notEqual(result[0], source[0])
  assert.equal(source[0]!.unitPriceMinor, 101)
})

test('credit lines reverse rounded amounts and authoritative tax exactly', () => {
  for (const quantityMilli of [1, 500, 1000, 1500, 3333]) {
    for (const unitPriceMinor of [1, 3, 101, 10000]) {
      for (const vatRateBasisPoints of [0, 900, 2100]) {
        for (const exactTaxMinor of [null, 0, 13]) {
          const source = { quantityMilli, unitPriceMinor, vatRateBasisPoints, exactTaxMinor }
          const [credit] = copyInvoiceLines([source], true)
          const net = invoiceLineAmount(quantityMilli, unitPriceMinor)
          const tax = exactTaxMinor ?? Math.round((net * vatRateBasisPoints) / 10000)
          assert.equal(
            invoiceLineAmount(credit!.quantityMilli, credit!.unitPriceMinor) + credit!.exactTaxMinor!,
            -(net + tax)
          )
          assert.equal(credit!.quantityMilli, quantityMilli)
          assert.equal(source.unitPriceMinor, unitPriceMinor)
        }
      }
    }
  }
})

test('only issued or paid positive invoices are eligible for full credit', () => {
  for (const status of ['DRAFT', 'ISSUED', 'PAID', 'VOID'] as const) {
    const eligible = ['ISSUED', 'PAID'].includes(status)
    assert.equal(canCreditInvoice({ status, documentType: 'invoice', totalMinor: 121 }), eligible)
    assert.equal(canCreditInvoice({ status, documentType: 'credit', totalMinor: 121 }), false)
    assert.equal(canCreditInvoice({ status, totalMinor: 0 }), false)
    assert.equal(canCreditInvoice({ status, totalMinor: -121 }), false)
  }
})

test('copied dates reset to today and retain the payment term across year boundaries', () => {
  assert.deepEqual(
    copiedInvoiceDates({ issueDate: '2026-01-01', dueDate: '2026-01-31' }, new Date('2026-12-20T15:00:00Z')),
    { issueDate: '2026-12-20', dueDate: '2027-01-19' }
  )
  assert.deepEqual(
    copiedInvoiceDates({ issueDate: '2026-01-02', dueDate: '2026-01-01' }, new Date('2026-11-04T15:00:00Z')),
    { issueDate: '2026-11-04', dueDate: '2026-11-04' }
  )
})

test('both mutation routes enforce active-organization manage access', () => {
  for (const action of ['duplicate', 'credit']) {
    const route = readFileSync(
      new URL(`../server/api/invoices/admin/invoices/[id]/${action}.post.ts`, import.meta.url),
      'utf8'
    )
    assert.match(route, /requireFeatureAccess\(event, invoicesFeature.policy, 'manage'\)/)
    assert.match(route, /copyInvoice\(organizationId, session.user.id, getRouterParam\(event, 'id'\)!/)
  }
})

test('menu actions and draft credit confirmation have matching English and Dutch translations', () => {
  const component = readFileSync(new URL('../app/components/InvoicesInvoiceDetail.vue', import.meta.url), 'utf8')
  assert.match(component, /v-if="!isClient && creditConfirmationOpen"\s+v-model:open="creditConfirmationOpen"/)
  assert.match(component, /if \(!isClient.value\) \{\s+items.push\(\.\.\.menuItems.value\)/)
  assert.match(component, /navigateTo\(\{ path: `\/admin\/invoices\/\$\{created.id\}`, query: \{ edit: 'true' \} \}\)/)
  assert.match(component, /props.invoice.status === 'ISSUED' && props.invoice.outstandingMinor > 0/)
  assert.match(component, /invoice.status === 'ISSUED' && invoice.outstandingMinor > 0"/)
  for (const locale of ['en', 'nl']) {
    const messages = JSON.parse(readFileSync(new URL(`../i18n/locales/${locale}.json`, import.meta.url), 'utf8'))
    for (const key of [
      'duplicateInvoice',
      'creditInvoice',
      'creditCreated',
      'invoiceDuplicated',
      'creditInvoiceDescription'
    ]) {
      assert.ok(messages.features.invoices.admin[key])
    }
  }
})
