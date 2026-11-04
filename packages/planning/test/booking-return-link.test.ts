import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { resolveCheckoutReturnUrl, resolveProductReturnUrl } from '../../products/shared/checkout-query'

const page = readFileSync(new URL('../app/pages/booking/[slug].vue', import.meta.url), 'utf8')
const script = page.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)![1]!
const parsed = ts.createSourceFile('booking.ts', script, ts.ScriptTarget.Latest, true)
const declarations = ['portalOrigin', 'returnUrl', 'productReturnUrl']
const source = ts.transpileModule(
  parsed.statements
    .filter(
      (statement) =>
        ts.isVariableStatement(statement) &&
        statement.declarationList.declarations.some(
          (declaration) => ts.isIdentifier(declaration.name) && declarations.includes(declaration.name.text)
        )
    )
    .map((statement) => statement.getText(parsed))
    .join('\n') + '\nexport { returnUrl, productReturnUrl }',
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText

function returnLinks(candidate?: string) {
  const exports = {} as { returnUrl: { value: string }; productReturnUrl: { value: string | undefined } }
  runInNewContext(source, {
    exports,
    route: { query: { returnUrl: candidate } },
    product: { checkoutAppearance: { returnUrl: 'https://store.example/services' } },
    computed: (getter: () => unknown) => ({
      get value() {
        return getter()
      }
    }),
    useRequestURL: () => new URL('https://saas.izzi.nl/store/discover-yourself/book'),
    resolveCheckoutReturnUrl,
    resolveProductReturnUrl
  })
  return exports
}

test('appointment booking returns to the exact admin product URL instead of the external offering', () => {
  const target = 'https://saas.izzi.nl/admin/products/2ce56341-1a45-4190-a5d2-a950cc970f64?scroll=42&tab=pricing#offers'
  const links = returnLinks(target)
  assert.equal(links.returnUrl.value, target)
  assert.equal(links.productReturnUrl.value, target)
  assert.match(page, /:href="returnUrl"/)
  assert.match(page, /productReturnUrl \? 'products.backToProduct' : 'products.backToOffering'/)
})

test('ordinary booking visits keep the configured offering link and reject foreign product return URLs', () => {
  for (const candidate of [undefined, 'https://attacker.example/admin/products/product', 'javascript:alert(1)']) {
    const links = returnLinks(candidate)
    assert.equal(links.returnUrl.value, 'https://store.example/services')
    assert.equal(links.productReturnUrl.value, undefined)
  }
})
