import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('appointment purchases suppress the generic receipt and delay invoice delivery', async () => {
  const orders = await readFile(new URL('../../products/server/utils/orders.ts', import.meta.url), 'utf8')
  const integration = await readFile(new URL('../server/plugins/purchases.ts', import.meta.url), 'utf8')
  const migration = await readFile(new URL('../migrations/0001_invoice_email_job.sql', import.meta.url), 'utf8')

  assert.match(orders, /order\.snapshot\.planningReservationId[\s\S]+notified=true/)
  assert.match(integration, /INSERT INTO invoice_products\.email_job/)
  assert.match(integration, /now\(\)\+interval '5 minutes'/)
  assert.match(integration, /order\.snapshot\.locale === 'nl' \? 'Aankoop' : 'Purchase'/)
  assert.match(integration, /order\.booking_reference/)
  assert.match(migration, /available_at timestamptz NOT NULL DEFAULT now\(\) \+ interval '5 minutes'/)
})
