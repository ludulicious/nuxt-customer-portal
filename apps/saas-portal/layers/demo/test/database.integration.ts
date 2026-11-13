import assert from 'node:assert/strict'
import { demoPool, resetDemoIfDue } from '../server/utils/demo-reset'

// Run only against a disposable, migrated database ending in _demo.
try {
  const database = (await demoPool.query('SELECT current_database() AS name')).rows[0].name
  assert.ok(database.endsWith('_demo'), 'Use only a disposable _demo database')
  const marker = (await demoPool.query("SELECT to_regclass('public.portal_demo_reset') AS name")).rows[0].name
  if (marker) {
    await demoPool.query("UPDATE public.portal_demo_reset SET reset_day='2000-01-01'")
  }
  await resetDemoIfDue()
  const counts = async () =>
    (
      await demoPool.query(`SELECT
    (SELECT count(*)::int FROM public."user") AS users,
    (SELECT count(*)::int FROM timesheets.time_entry) AS entries,
    (SELECT count(*)::int FROM invoices.invoice) AS invoices,
    (SELECT count(*)::int FROM service_requests.service_request) AS requests,
    (SELECT count(*)::int FROM products.product) AS products,
    (SELECT count(*)::int FROM products.orders) AS orders,
    (SELECT count(*)::int FROM planning.provider) AS providers,
    (SELECT count(*)::int FROM planning.appointment) AS appointments`)
    ).rows[0]
  const before = await counts()
  assert.equal(before.users, 7)
  assert.equal(before.invoices, 12)
  assert.equal(before.requests, 36)
  assert.equal(before.products, 3)
  assert.equal(before.orders, 4)
  assert.equal(before.providers, 2)
  assert.equal(before.appointments, 3)
  assert.ok(before.entries >= 540)
  const configuration = (
    await demoPool.query('SELECT settings, completed_at FROM saas_configuration.portal_settings WHERE id=true')
  ).rows[0]
  assert.ok(configuration.completed_at)
  assert.ok(configuration.settings.enabledModules.includes('planning'))
  assert.ok(configuration.settings.enabledModules.includes('service-requests'))
  const resetState = (await demoPool.query('SELECT reset_day FROM public.portal_demo_reset WHERE id=true')).rows[0]
  await demoPool.query('DELETE FROM public.portal_demo_reset WHERE id=true')
  try {
    await assert.rejects(resetDemoIfDue(), /Initial demo setup requires an empty, migrated database/)
    assert.deepEqual(await counts(), before)
  } finally {
    await demoPool.query(
      'INSERT INTO public.portal_demo_reset (id, reset_day) VALUES (true, $1) ON CONFLICT (id) DO UPDATE SET reset_day=EXCLUDED.reset_day',
      [resetState.reset_day]
    )
  }
  await demoPool.query(
    "UPDATE service_requests.service_request SET title = 'Visitor edit' WHERE id = 'demo-garden-invoice-0-request-0'"
  )
  await resetDemoIfDue()
  assert.equal(
    (
      await demoPool.query(
        "SELECT title FROM service_requests.service_request WHERE id = 'demo-garden-invoice-0-request-0'"
      )
    ).rows[0].title,
    'Visitor edit'
  )
  await demoPool.query("UPDATE public.portal_demo_reset SET reset_day = '2000-01-01'")
  await Promise.all([resetDemoIfDue(), resetDemoIfDue()])
  assert.deepEqual(await counts(), before)
  assert.equal(
    (
      await demoPool.query(
        "SELECT title FROM service_requests.service_request WHERE id = 'demo-garden-invoice-0-request-0'"
      )
    ).rows[0].title,
    'Update the onboarding screens'
  )
  assert.equal((await demoPool.query('SELECT count(*)::int AS count FROM public.session')).rows[0].count, 0)
  console.log(
    'Database integration passed: full seed, same-day preservation, concurrent reset, visitor edits and sessions discarded'
  )
} finally {
  await demoPool.end()
}
